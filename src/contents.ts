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

  const rawCreated = data.created
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
