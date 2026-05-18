import { Link } from './markdown'
import contentData from 'virtual:content-data'

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

const generatedContentData = contentData as {
  contents: Content[]
  metaData: MetaData
}

export async function getContent(slug: string): Promise<Content> {
  const content = generatedContentData.contents.find((content) => content.slug === slug)
  if (content == null) throw new Error(`content not found: ${slug}`)
  return content
}

export async function getAllContents(): Promise<Content[]> {
  return generatedContentData.contents
}

export async function getAllSlugs(): Promise<string[]> {
  return generatedContentData.contents.map((content) => content.slug)
}

export function compareDateLike(d1: DateLikeObject, d2: DateLikeObject): number {
  const { year: year1, month: month1, day: day1 } = d1
  const { year: year2, month: month2, day: day2 } = d2
  return year1 - year2 || month1 - month2 || day1 - day2
}

export function getMetaData(): Promise<MetaData> {
  return Promise.resolve(generatedContentData.metaData)
}
