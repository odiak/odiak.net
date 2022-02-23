import { unified } from 'unified'
import remarkParse from 'remark-parse'
import wikiLinkPlugin from 'remark-wiki-link'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import strip from 'strip-markdown'
import remarkStringify from 'remark-stringify'

export function makeDescription(content: string): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(wikiLinkPlugin, { permalinks: [] })
    .use(remarkStringify)
    .use(strip)
    .processSync(content.split('\n\n', 1)[0])
    .toString()
    .trim()
    .split('\n', 1)[0]
}
