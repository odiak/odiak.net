import glob from 'glob'
import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { Link } from './markdown'

export type LinkWithOneHopLinks = Link & {
  oneHopLinks?: Array<Link> | null
}

export type DateLikeObject = { year: number; month: number; day: number }
export type Content = {
  name: string
  slug: string
  rawData: Record<string, unknown> | null
  body: string
  created: DateLikeObject | null
  modified: DateLikeObject | null
  isRandom: boolean
  isArchived: boolean
  title: string
  isPinned: boolean
  isIntermediate: boolean
}

type Contents = Map<string, Content>

export type MetaData = {
  nameToSlugMap: Record<string, string>
  slugToTitleMap: Record<string, string>
  nameToLinksMap: Record<string, LinksInformation>
}

export type LinksInformation = {
  isIntermediate: boolean
  outgoing: Array<{
    name: string
    oneHopLinks: Array<{ name: string }>
  }>
  incoming: Array<{
    name: string
  }>
}

let contents: Promise<Contents> | undefined = undefined

let metaData: Promise<MetaData> | undefined = undefined

function extractDateFromBeginning(text: string): Date | undefined {
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?=\D|$)/)
  if (m === null) return
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const day = parseInt(m[3], 10)
  return new Date(year, month - 1, day)
}

function ensureString(v: unknown, name = 'value'): asserts v is string {
  if (typeof v !== 'string') {
    throw new Error(`Unexpected ${name}: ${v}`)
  }
}

export async function loadContent(
  fileName: string,
  includeRawData: boolean = false
): Promise<Content> {
  const rawBody = await fs.readFile(`contents/${fileName}`, 'utf8')

  const { content: body, data } = matter(rawBody) as {
    content: string
    data: Record<string, unknown>
  }

  const name = path.basename(fileName, '.md')
  const title = data.title ?? name
  ensureString(title, 'title')

  const slug = data.slug ?? name
  ensureString(slug, 'slug')

  const explicitRawCreated = data.created ?? extractDateFromBeginning(slug)
  const isRandom = explicitRawCreated == null
  const created = dateToDateLikeObject(explicitRawCreated ?? data.fileCreated)
  const modified = dateToDateLikeObject(data.fileModified)

  const isPinned = Boolean(data.pinned)
  const isIntermediate = Boolean(data.intermediate)
  const isArchived = Boolean(data.archived)

  return {
    name,
    slug,
    body,
    rawData: includeRawData ? data : null,
    created,
    modified,
    isRandom,
    title,
    isPinned,
    isIntermediate,
    isArchived
  }
}

export function ensureContents(): Promise<Contents> {
  if (contents !== undefined) return contents

  return (contents = (async () => {
    const contentsArray = await Promise.all(
      glob
        .sync('contents/*.md')
        .map((filePath) => path.basename(filePath))
        .map((baseName) => loadContent(baseName))
    )
    return new Map(contentsArray.map((c) => [c.slug, c]))
  })())
}

function dateToDateLikeObject(date: unknown): DateLikeObject | null {
  if (date == null) return null
  if (!(date instanceof Date)) {
    throw new Error(`not date: ${date}`)
  }
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

export function getMetaData(): Promise<MetaData> {
  if (metaData !== undefined) return metaData

  return (metaData = (async () => {
    const raw = await fs.readFile('contents/metadata.json', 'utf8')
    return JSON.parse(raw) as MetaData
  })())
}
