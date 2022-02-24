import { unified } from 'unified'
import remarkParse from 'remark-parse'
import wikiLinkPlugin from 'remark-wiki-link'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import strip from 'strip-markdown'
import remarkStringify from 'remark-stringify'
import { Node } from 'unist'

export function makeDescription(content: string): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(wikiLinkPlugin, { permalinks: [] })
    .use(remarkStringify)
    .use(stripWikiLink)
    .use(strip)
    .processSync(content.split('\n\n', 1)[0])
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
}

function stripWikiLink(): (node: Node) => Node {
  function strip(node: Node): Node {
    if (node.type === 'wikiLink') {
      return { type: 'text', value: node.value }
    }
    if (!Array.isArray(node.children)) {
      return node
    }
    return { ...node, children: (node.children as Node[]).map(strip) }
  }

  return strip
}
