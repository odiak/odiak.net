import unified from 'unified'
import remarkParse from 'remark-parse'
import { wikiLinkPlugin } from 'remark-wiki-link'
import { Content } from './contents'
import { Node } from 'unist'

export function getProcessor(contents: Content[]) {
  return unified()
    .use(remarkParse)
    .use(wikiLinkPlugin, {
      permalinks: contents.map((c) => c.slug),
      pageResolver: (name: string): string[] =>
        contents
          .filter((c) => c.title === name)
          .map((c) => c.slug)
          .concat([name]),
      hrefTemplate: (slug: string) => `/${slug}`
    })
}

export type Link = {
  name: string
  slug: string
}

function collectAllLinks(content: Node, links: Set<Link>) {
  if (content.type === 'wikiLink') {
    const data = content.data as { permalink: string; alias: string }
    links.add({ name: data.alias, slug: data.permalink })
  }
  if (content.children == null) return
  for (const child of content.children as Node[]) {
    collectAllLinks(child, links)
  }
}

export function collectAllInternalLinks(content: Node): Link[] {
  const links = new Set<Link>()
  collectAllLinks(content, links)
  return Array.from(links)
}
