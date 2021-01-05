import glob from 'glob'
import fs from 'fs'
import matter from 'gray-matter'

export function getAllSlugs(): string[] {
  return glob.sync('contents/*.md').map((s) => s.match(/\/([^\/]+)\.md$/)![1])
}

export type DateLikeObject = { year: number; month: number; day: number }
export type Content = {
  slug: string
  body: string
  created: DateLikeObject
  title: string
  isPinned: boolean
}

export function getContent(slug: string): Content {
  const rawBody = fs.readFileSync(`contents/${slug}.md`, 'utf8')

  const { content: body, data } = matter(rawBody)

  const title = data.title
  if (typeof title !== 'string') throw Error(`Invalid title for ${slug}`)

  let rawCreated = data.created
  if (rawCreated == null) {
    // guess date
    const m = slug.match(/^(\d{4})-(\d{2})-(\d{2})(?=\D|$)/)
    if (m != null) {
      rawCreated = new Date(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10))
    }
  }
  if (!(rawCreated instanceof Date)) throw Error(`Invalid created date for ${slug}`)

  const created = dateToDateLikeObject(rawCreated)

  const isPinned = data.pinned === true

  return { slug, body, created, title, isPinned }
}

function dateToDateLikeObject(date: Date): DateLikeObject {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  }
}
