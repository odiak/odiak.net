import path from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

/** Vault folder whose images are published under `/images/`. */
export const IMAGE_SOURCE_PREFIX = 'public/images/'

const imageExtensionPattern = /\.(avif|gif|jpe?g|png|svg|webp)$/i

export function isPublishedImagePath(vaultPath: string): boolean {
  return vaultPath.startsWith(IMAGE_SOURCE_PREFIX) && imageExtensionPattern.test(vaultPath)
}

/** Site URL of a published image; every segment is percent-encoded, parentheses included. */
export function imageUrl(vaultPath: string): string {
  const segments = vaultPath.slice(IMAGE_SOURCE_PREFIX.length).split('/')
  return `/images/${segments
    .map((s) => encodeURIComponent(s).replace(/\(/g, '%28').replace(/\)/g, '%29'))
    .join('/')}`
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Relative to the note first, then from the vault root, as Obsidian writes either. */
function resolvePath(target: string, notePath: string, images: Set<string>): string | undefined {
  for (const candidate of [path.posix.join(path.posix.dirname(notePath), target), target]) {
    const normalized = path.posix.normalize(candidate)
    if (images.has(normalized)) return normalized
  }
}

/** `![alt](url)`: the published image a relative URL points to, if any. */
export function resolveImageUrl(
  url: string,
  notePath: string,
  images: Set<string>
): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('#')) return
  return resolvePath(safeDecode(url), notePath, images)
}

/** `![[target]]`: a path, or else a file name anywhere in the published images. */
export function resolveEmbedTarget(
  target: string,
  notePath: string,
  images: Set<string>
): string | undefined {
  const byPath = resolvePath(target, notePath, images)
  if (byPath) return byPath
  const name = target.toLowerCase()
  return [...images].sort().find((image) => path.posix.basename(image).toLowerCase() === name)
}

type PositionedNode = {
  type: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  children?: PositionedNode[]
}

function codeRanges(markdown: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const visit = (node: PositionedNode) => {
    if (node.type === 'code' || node.type === 'inlineCode' || node.type === 'html') {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start != null && end != null) ranges.push([start, end])
      return
    }
    node.children?.forEach(visit)
  }
  visit(unified().use(remarkParse).parse(markdown) as PositionedNode)
  return ranges
}

const embedPattern = /!\[\[([^\[\]|#^]+)(?:\|([^\[\]]*))?\]\]/g

function escapeAlt(text: string): string {
  return text.replace(/[\\\[\]]/g, '\\$&')
}

/**
 * Turn Obsidian image embeds (`![[a.png]]`, `![[a.png|300]]`) into Markdown
 * images. Code is left alone, as are embeds that match no published image.
 * A size is kept the way Obsidian writes it for Markdown images: `![alt|300](url)`.
 */
export function rewriteImageEmbeds(
  markdown: string,
  notePath: string,
  images: Set<string>
): string {
  if (!markdown.includes('![[')) return markdown
  const ranges = codeRanges(markdown)
  return markdown.replace(
    embedPattern,
    (match, target: string, option: string | undefined, offset: number) => {
      if (ranges.some(([start, end]) => offset >= start && offset < end)) return match
      const image = resolveEmbedTarget(target.trim(), notePath, images)
      if (!image) return match
      const alt = path.posix.basename(image).replace(imageExtensionPattern, '')
      const size = option?.trim().match(/^\d+(x\d+)?$/) ? `|${option.trim()}` : ''
      return `![${escapeAlt(alt)}${size}](${imageUrl(image)})`
    }
  )
}
