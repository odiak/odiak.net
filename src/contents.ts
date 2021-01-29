import glob from 'glob'
import fs from 'fs'
import matter from 'gray-matter'
import { collectAllInternalLinks, getProcessor, Link } from './markdown'

export type LinkWithOneHopLinks = Link & {
  oneHopLinks?: Array<Link>
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
  outgoingLinks?: Array<LinkWithOneHopLinks>
  incomingLinks?: Array<Link>
}

function loadContent(slug: string): Content {
  const rawBody = fs.readFileSync(`contents/${slug}.md`, 'utf8')

  const { content: body, data } = matter(rawBody)

  const title = data.title
  if (typeof title !== 'string') throw Error(`Invalid title for ${slug}`)

  let rawCreated = data.created
  if (rawCreated == null) {
    // guess date
    const m = slug.match(/^(\d{4})-(\d{2})-(\d{2})(?=\D|$)/)
    if (m != null) {
      rawCreated = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
    }
  }
  if (!(rawCreated instanceof Date)) throw Error(`Invalid created date for ${slug}`)

  const created = dateToDateLikeObject(rawCreated)

  const isPinned = data.pinned === true

  return { slug, body, created, title, isPinned, isIntermediate: false }
}

const contents = new Map<string, Content>()

function prepareContents() {
  const slugs = glob.sync('contents/*.md').map((s) => s.match(/\/([^\/]+)\.md$/)![1])
  for (const slug of slugs) {
    contents.set(slug, loadContent(slug))
  }

  const processor = getProcessor(Array.from(contents.values()))
  const existingSlugs = new Set(slugs)
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

  // prepare one-hop links
  for (const [fromSlug, links] of directLinkMap) {
    const fromContent = contents.get(fromSlug)!
    for (const { slug: toSlug } of links) {
      const toContent = contents.get(toSlug)!
      const linksToAdd = toContent.incomingLinks!.filter((link) => link.slug !== fromSlug)
      if (linksToAdd.length === 0) continue
      const outgoingLink = fromContent.outgoingLinks!.find((link) => link.slug === toSlug)!
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
}

function dateToDateLikeObject(date: Date): DateLikeObject {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  }
}

export function getContent(slug: string): Content {
  const content = contents.get(slug)
  if (content == null) throw new Error(`content not found: ${slug}`)
  return content
}

export function getAllContents(): Content[] {
  return Array.from(contents.values())
}

export function getAllSlugs(): string[] {
  return Array.from(contents.keys())
}

prepareContents()
