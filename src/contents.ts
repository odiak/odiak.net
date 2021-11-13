import glob from 'glob'
import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { collectAllInternalLinks, getProcessor, Link } from './markdown'

export type LinkWithOneHopLinks = Link & {
  oneHopLinks?: Array<Link> | null
}

export type DateLikeObject = { year: number; month: number; day: number }
export type Content = {
  slug: string
  body: string
  created: DateLikeObject
  title: string
  isPinned: boolean
  isIntermediate: boolean
  isLinkedFromMultipleContents?: boolean
  outgoingLinks?: Array<LinkWithOneHopLinks> | null
  incomingLinks?: Array<Link> | null
}

type Contents = Map<string, Content>

let contents: Promise<Contents> | undefined = undefined

function extractDateFromBeginning(text: string): Date | undefined {
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?=\D|$)/)
  if (m === null) return
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const day = parseInt(m[3], 10)
  return new Date(year, month - 1, day)
}

async function loadContent(fileName: string): Promise<Content> {
  const rawBody = await fs.readFile(`contents/${fileName}`, 'utf8')

  const { content: body, data } = matter(rawBody)

  const title = data.title ?? path.basename(fileName, '.md')
  if (typeof title !== 'string') throw Error(`Invalid title for ${fileName}`)

  const slug = data.slug
  if (typeof slug !== 'string') throw Error(`Invalid slug for ${fileName}`)

  let rawCreated = data.created ?? extractDateFromBeginning(slug)
  if (!(rawCreated instanceof Date)) throw Error(`Invalid created date for ${fileName}`)

  const created = dateToDateLikeObject(rawCreated)

  const isPinned = Boolean(data.pinned)

  return { slug, body, created, title, isPinned, isIntermediate: false }
}

async function prepareContents(): Promise<Contents> {
  const contents: Contents = new Map()
  const promises = glob
    .sync('contents/*.md')
    .map((s) => path.basename(s))
    .map((f) =>
      loadContent(f).then((content) => {
        contents.set(content.slug, content)
      })
    )
  await Promise.all(promises)

  const processor = getProcessor(Array.from(contents.values()))
  const existingSlugs = new Set([...contents.values()].map((c) => c.slug))
  const unknownSlugs = new Set<string>()
  const intermediateSlugs = new Set<string>()
  const nameBySlug = new Map<string, string>()
  const directLinkMap = new Map<string, Link[]>()
  for (const content of contents.values()) {
    const node = processor.parse(content.body)
    const links = collectAllInternalLinks(node)
    if (links.length === 0) continue
    directLinkMap.set(content.slug, links)
    for (const link of links) {
      const { slug, name } = link
      if (!existingSlugs.has(slug)) {
        nameBySlug.set(slug, name)
        if (unknownSlugs.has(slug)) {
          intermediateSlugs.add(slug)
        } else {
          unknownSlugs.add(slug)
        }
      }
    }
  }

  // create non-existing pages
  for (const slug of unknownSlugs) {
    const name = nameBySlug.get(slug)!
    contents.set(slug, {
      body: '',
      title: name,
      slug: slug,
      isPinned: false,
      isIntermediate: true,
      isLinkedFromMultipleContents: intermediateSlugs.has(slug),
      created: { year: 0, month: 1, day: 1 }
    })
  }

  // normalize name of links
  for (const [slug, links] of directLinkMap) {
    directLinkMap.set(
      slug,
      links.map(({ slug }) => ({ slug, name: contents.get(slug)!.title }))
    )
  }

  // prepare incoming links
  for (const [fromSlug, links] of directLinkMap) {
    const fromContent = contents.get(fromSlug)!
    const outgoingLinks = (fromContent.outgoingLinks ??= [])
    outgoingLinks.push(...links)
    for (const { slug: toSlug } of links) {
      const toContent = contents.get(toSlug)!
      const incomingLinks = (toContent.incomingLinks ??= [])
      incomingLinks.push({ slug: fromSlug, name: fromContent.title })
    }
  }

  // remove some outgoing links
  for (const content of contents.values()) {
    if (content.outgoingLinks == null) continue
    content.outgoingLinks = content.outgoingLinks.filter(
      ({ slug }) => contents.get(slug)!.isLinkedFromMultipleContents !== false
    )
    if (content.outgoingLinks.length === 0) {
      content.outgoingLinks = null
    }
  }

  // prepare one-hop links
  for (const [fromSlug, links] of directLinkMap) {
    const fromContent = contents.get(fromSlug)!
    for (const { slug: toSlug } of links) {
      const toContent = contents.get(toSlug)!
      const linksToAdd = toContent.incomingLinks!.filter((link) => link.slug !== fromSlug)
      if (linksToAdd.length === 0) continue
      if (fromContent.outgoingLinks == null) continue
      const outgoingLink = fromContent.outgoingLinks.find((link) => link.slug === toSlug)!
      const links = (outgoingLink.oneHopLinks ??= [])
      links.push(...linksToAdd)
    }
  }

  // remove duplicated links
  for (const content of contents.values()) {
    const slugs = new Set(content.outgoingLinks?.map((link) => link.slug))
    if (content.incomingLinks != null) {
      content.incomingLinks = content.incomingLinks.filter((link) => !slugs.has(link.slug))
      for (const { slug } of content.incomingLinks) slugs.add(slug)
    }
    if (content.outgoingLinks != null) {
      for (const outLink of content.outgoingLinks) {
        if (outLink.oneHopLinks != null) {
          outLink.oneHopLinks = outLink.oneHopLinks.filter((link) => !slugs.has(link.slug))
          for (const { slug } of outLink.oneHopLinks) slugs.add(slug)
        }
      }
    }
  }

  return contents
}

export async function ensureContents(forceReload: boolean = false): Promise<Contents> {
  const oldContents = contents
  if (!forceReload && oldContents) return oldContents

  // wait for previous loading
  const oldContentsValue = await oldContents

  const newContents = prepareContents().catch((e) => {
    console.error(e)
    if (oldContentsValue) return oldContentsValue
    throw e
  })
  contents = newContents
  return newContents
}

function dateToDateLikeObject(date: Date): DateLikeObject {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  }
}

export async function getContent(slug: string): Promise<Content> {
  const content = (await ensureContents()).get(slug)
  if (content == null) throw new Error(`content not found: ${slug}`)
  return content
}

export async function getAllContents(): Promise<Content[]> {
  return Array.from((await ensureContents()).values())
}

export async function getAllSlugs(): Promise<string[]> {
  return Array.from((await ensureContents()).keys())
}

export function compareDateLike(d1: DateLikeObject, d2: DateLikeObject): number {
  const { year: year1, month: month1, day: day1 } = d1
  const { year: year2, month: month2, day: day2 } = d2
  return year1 - year2 || month1 - month2 || day1 - day2
}
