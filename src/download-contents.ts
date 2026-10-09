import { fetchKuroContents, fetchKuroImages } from './kuro-contents'
import fsp from 'fs/promises'
import { loadContent, Content, LinksInformation, MetaData } from './node-contents'
import path from 'path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import wikiLinkPlugin from 'remark-wiki-link'
import { collectAllInternalLinks } from './markdown'
import { Node } from 'unist'
import remarkStringify from 'remark-stringify'
import matter from 'gray-matter'
import { IMAGE_SOURCE_PREFIX, imageUrl, resolveImageUrl, rewriteImageEmbeds } from './images'

const imageDirectory = 'public/images'

export async function downloadContents() {
  const token = process.env['KURO_API_TOKEN']
  if (!token) throw new Error('KURO_API_TOKEN is required')

  const notes = await fetchKuroContents(token)
  const images = await fetchKuroImages(token)
  await fsp.rm('contents', { recursive: true, force: true })
  await fsp.mkdir('contents')
  for (const note of notes) {
    await fsp.writeFile(`contents/${note.name}.md`, note.content, 'utf8')
  }
  await fsp.rm(imageDirectory, { recursive: true, force: true })
  for (const image of images) {
    const file = path.join(imageDirectory, image.sourcePath.slice(IMAGE_SOURCE_PREFIX.length))
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await fsp.writeFile(file, image.bytes)
  }
  console.log(`Downloaded ${notes.length} public notes and ${images.length} images from Kuro`)

  const sourceNames = new Map(
    notes.map((note) => [note.sourcePath.slice('public/'.length, -3), note.name])
  )
  await preprocessContents(
    notes.map((note) => note.name),
    sourceNames,
    new Map(notes.map((note) => [note.name, note.sourcePath])),
    new Set(images.map((image) => image.sourcePath))
  )
}

async function preprocessContents(
  names: string[],
  sourceNames: Map<string, string>,
  sourcePaths: Map<string, string>,
  images: Set<string>
) {
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
    if (slugToTitleMap.has(content.slug)) throw new Error(`Duplicate article slug: ${content.slug}`)
    nameToSlugMap.set(name, content.slug)
    slugToTitleMap.set(content.slug, content.title)
  }

  const singletonNames = new Set<string>()

  function getCanonicalName(name: string): string {
    const matchedName = Array.from(nameToSlugMap.keys()).find(
      (n) => n.toLowerCase() === name.toLowerCase()
    )
    if (matchedName) return matchedName
    if (
      path.basename(name) !== name ||
      name === '.' ||
      name === '..' ||
      /[\\\x00-\x1f]/.test(name)
    ) {
      throw new Error(`Invalid linked article name: ${name}`)
    }
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

    const notePath = sourcePaths.get(content.name)!
    let body = rewriteImageEmbeds(content.body, notePath, images)
    const node = processor.parse(body)
    if (normalizeNoteLinks(node, sourceNames, (url) => resolveImageUrl(url, notePath, images))) {
      body = processor.stringify(node)
    }
    if (body !== content.body) {
      content.body = body
      await fsp.writeFile(
        `contents/${content.name}.md`,
        matter.stringify(content.body, content.rawData as Record<string, unknown>)
      )
    }

    const links = collectAllInternalLinks(node)
    for (const { name: linkName } of links) {
      // Resolved public paths were shortened above; leave other paths out of related articles.
      if (linkName.includes('/') || linkName.includes('\\')) continue
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

type MarkdownNode = Node & {
  value?: string
  url?: string
  data?: { alias?: string; permalink?: string }
  children?: MarkdownNode[]
}

function normalizeNoteLinks(
  node: MarkdownNode,
  sourceNames: Map<string, string>,
  resolveImage: (url: string) => string | undefined
): boolean {
  let modified = false
  if (node.type === 'image' && node.url) {
    const image = resolveImage(node.url)
    if (image) {
      node.url = imageUrl(image)
      modified = true
    }
  }
  if (node.type === 'wikiLink') {
    const original = node.value as string
    const relative = original.replace(/^public\//, '').replace(/\.md$/, '')
    const name = sourceNames.get(relative)
    if (name && name !== original) {
      node.value = name
      if (node.data?.alias === original) node.data.alias = name
      if (node.data) node.data.permalink = name
      modified = true
    }
  }
  for (const child of node.children ?? []) {
    modified = normalizeNoteLinks(child, sourceNames, resolveImage) || modified
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
