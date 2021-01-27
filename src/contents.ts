import glob from 'glob'
import fs from 'fs'
import matter from 'gray-matter'

export type DateLikeObject = { year: number; month: number; day: number }
export type Content = {
  slug: string
  body: string
  created: DateLikeObject
  title: string
  isPinned: boolean
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

  return { slug, body, created, title, isPinned }
}

const contents: Content[] = []
function prepareContents() {
  const slugs = glob.sync('contents/*.md').map((s) => s.match(/\/([^\/]+)\.md$/)![1])
  contents.push(...slugs.map((slug) => loadContent(slug)))
}

function dateToDateLikeObject(date: Date): DateLikeObject {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  }
}

export function getContent(slug: string): Content {
  const content = contents.find((c) => c.slug === slug)
  if (content == null) throw new Error(`content not found: ${slug}`)
  return content
}

export function getAllSlugs(): string[] {
  return contents.map((c) => c.slug)
}

prepareContents()
