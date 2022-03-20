import { google } from 'googleapis'
import fsp from 'fs/promises'
import { loadContent, Content, LinksInformation, MetaData } from './contents'
import path from 'path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import wikiLinkPlugin from 'remark-wiki-link'
import { collectAllInternalLinks } from './markdown'
import { Node } from 'unist'
import remarkStringify from 'remark-stringify'
import matter from 'gray-matter'

export async function downloadContents() {
  const credentials = JSON.parse(process.env['GOOGLE_CREDENTIALS'] ?? '{}')
  const folderId = process.env['FOLDER_ID']

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  })
  const drive = google.drive({ version: 'v3', auth })

  await fsp.rm('contents', { recursive: true, force: true })
  await fsp.mkdir('contents')

  let pageToken: string | undefined
  const promises: Array<Promise<unknown>> = []
  const names: Array<string> = []
  do {
    const data = (
      await drive.files.list({
        q: `'${folderId}' in parents`,
        pageToken,
        fields: 'files(id,name,createdTime,modifiedTime)'
      })
    ).data
    if (data.files) {
      for (const file of data.files) {
        if (!file.name!.endsWith('.md')) continue

        names.push(path.basename(file.name!, '.md'))
        console.log(`downloading ${file.name}`)
        const filePath = `contents/${file.name}`
        const promise = drive.files
          .get({ fileId: file.id!, alt: 'media' }, { responseType: 'stream' })
          .then(async ({ data: stream }) => {
            const chunks: Buffer[] = []
            stream.on('data', (chunk) => {
              chunks.push(Buffer.from(chunk))
            })
            await new Promise((resolve, reject) => {
              stream.on('error', reject)
              stream.on('end', async () => {
                let content = Buffer.concat(chunks).toString('utf8')
                const { content: body, data } = matter(content)
                data.fileCreated = new Date(file.createdTime!)
                data.fileModified = new Date(file.modifiedTime!)
                content = matter.stringify(body, data)
                fsp.writeFile(filePath, content, 'utf8')
                resolve(undefined)
              })
            })
          })
        promises.push(promise)
      }
    }
    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)
  await Promise.all(promises)

  await preprocessContents(names)
}

async function preprocessContents(names: string[]) {
  const processor = unified()
    .use(remarkParse)
    .use(wikiLinkPlugin, {
      permalinks: [],
      pageResolver: (name: string): string[] => [name],
      hrefTemplate: (slug: string) => `/${slug}`
    })
    .use(remarkStringify, {
      bullet: '-'
    })

  const nameToSlugMap = new Map<string, string>()
  const slugToTitleMap = new Map<string, string>()

  const contents: Content[] = []
  for (const name of names) {
    const content = await loadContent(`${name}.md`, true)
    contents.push(content)
    nameToSlugMap.set(name, content.slug)
    slugToTitleMap.set(content.slug, content.title)
  }

  const singletonNames = new Set<string>()

  function getCanonicalName(name: string): string {
    const matchedName = Array.from(nameToSlugMap.keys()).find(
      (n) => n.toLowerCase() === name.toLowerCase()
    )
    if (matchedName) return matchedName
    const slug = name
    nameToSlugMap.set(name, slug)
    singletonNames.add(name)
    slugToTitleMap.set(slug, name)
    return name
  }

  const nameToLinksMap = new Map<string, LinksInformation>(
    contents.map(({ name }) => [name, { incoming: [], outgoing: [], isIntermediate: false }])
  )
  for (const content of contents) {
    const linksInfo = nameToLinksMap.get(content.name)!

    const node = processor.parse(content.body)
    const modified = removePrefixesFromNode(node, 'public/')
    if (modified) {
      content.body = processor.stringify(node)
      await fsp.writeFile(
        `contents/${content.name}.md`,
        matter.stringify(content.body, content.rawData as Record<string, unknown>)
      )
    }

    const links = collectAllInternalLinks(node)
    for (const { name: linkName } of links) {
      const canonicalName = getCanonicalName(linkName)
      if (!nameToLinksMap.has(canonicalName)) {
        nameToLinksMap.set(canonicalName, { incoming: [], outgoing: [], isIntermediate: true })
      }
      const targetLinksInfo = nameToLinksMap.get(canonicalName)!
      if (!targetLinksInfo.incoming.find((li) => li.name === content.name)) {
        targetLinksInfo.incoming.push({ name: content.name })
      }
      if (targetLinksInfo.incoming.length >= 2) {
        singletonNames.delete(canonicalName)
      }

      if (!linksInfo.outgoing.find((li) => li.name === canonicalName)) {
        linksInfo.outgoing.push({ name: canonicalName, oneHopLinks: [] })
      }
    }
  }

  for (const [name, linksInfo] of nameToLinksMap) {
    linksInfo.outgoing = linksInfo.outgoing.filter((li) => !singletonNames.has(li.name))
    for (const li of linksInfo.outgoing) {
      li.oneHopLinks = nameToLinksMap.get(li.name)!.incoming.filter((li) => li.name !== name)
    }

    if (linksInfo.isIntermediate) {
      await fsp.writeFile(
        `contents/${name}.md`,
        `---
intermediate: true
---`
      )
    }

    filterLinks(linksInfo, nameToSlugMap)
  }

  const metaData: MetaData = {
    nameToSlugMap: mapToObject(nameToSlugMap),
    slugToTitleMap: mapToObject(slugToTitleMap),
    nameToLinksMap: mapToObject(nameToLinksMap)
  }
  await fsp.writeFile('contents/metadata.json', JSON.stringify(metaData))
}

function mapToObject<T>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map.entries())
}

function removePrefix(str: string, prefix: string): string {
  if (str.startsWith(prefix)) {
    return str.slice(prefix.length)
  }
  return str
}

function removePrefixesFromNode(node: Node, prefix: string): boolean {
  let modified = false
  if (node.type === 'wikiLink') {
    node.value = node.data!.alias = removePrefix(node.value as string, prefix)
    modified = true
  }
  if (!Array.isArray(node.children)) return modified
  for (const child of node.children as Node[]) {
    modified = removePrefixesFromNode(child, prefix) || modified
  }
  return modified
}

function filterLinks(links: LinksInformation, nameToSlug: Map<string, string>) {
  const usedSlugs = new Set<string>()
  function filterFn({ name }: { name: string }): boolean {
    const slug = nameToSlug.get(name)!
    if (usedSlugs.has(slug)) return false
    usedSlugs.add(slug)
    return true
  }
  links.outgoing = links.outgoing.filter(filterFn)
  for (const li of links.outgoing) {
    li.oneHopLinks = li.oneHopLinks.filter(filterFn)
  }
  links.incoming = links.incoming.filter(filterFn)
}

downloadContents()
