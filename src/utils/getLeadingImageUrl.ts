import { unified } from 'unified'
import remarkParse from 'remark-parse'

const siteUrl = 'https://odiak.net/'

type MarkdownNode = {
  type: string
  url?: string
  children?: MarkdownNode[]
}

export function getLeadingImageUrl(markdown: string): string | undefined {
  const root = unified().use(remarkParse).parse(markdown) as MarkdownNode
  const firstNode = root.children?.[0]
  if (firstNode == null) return

  const imageUrl = findImageUrl(firstNode)
  if (imageUrl == null) return

  return toAbsoluteHttpUrl(imageUrl)
}

function findImageUrl(node: MarkdownNode): string | undefined {
  if (node.type === 'image') return node.url

  if (node.type === 'paragraph') {
    const meaningfulChildren = node.children?.filter((child) => child.type !== 'text') ?? []
    if (meaningfulChildren.length !== 1) return
    return findImageUrl(meaningfulChildren[0])
  }

  if (node.type === 'link') {
    const children = node.children ?? []
    if (children.length !== 1) return
    return findImageUrl(children[0])
  }
}

function toAbsoluteHttpUrl(url: string): string | undefined {
  try {
    const absoluteUrl = new URL(url, siteUrl)
    if (absoluteUrl.protocol !== 'http:' && absoluteUrl.protocol !== 'https:') return
    return absoluteUrl.toString()
  } catch {
    return
  }
}
