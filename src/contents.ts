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

  for (const [slug, links] of directLinkMap.entries()) {
    const validLinks = links
      .filter((link) => contents.has(link.slug))
      .map(({ slug }) => ({ slug, name: contents.get(slug)!.title }))
    if (validLinks.length === 0) continue
    const content = contents.get(slug)!
    const outgoingLinks = (content.outgoingLinks ??= [])
    outgoingLinks.push(...validLinks)
    for (const { slug: slug2 } of validLinks) {
      const content2 = contents.get(slug2)!
      const incomingLinks = (content2.incomingLinks ??= [])
      incomingLinks.push({ slug, name: content.title })
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
