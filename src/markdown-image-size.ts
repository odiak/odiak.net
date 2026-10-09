type MarkdownNode = {
  type: string
  alt?: string | null
  data?: { hProperties?: Record<string, unknown> }
  children?: MarkdownNode[]
}

/** Obsidian's image size in the alt text: `![alt|300](url)` or `![alt|300x200](url)`. */
export function remarkImageSize() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      const match = node.type === 'image' ? node.alt?.match(/^(.*?)\|(\d+)(?:x(\d+))?$/) : null
      if (match) {
        node.alt = match[1]
        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            width: Number(match[2]),
            ...(match[3] ? { height: Number(match[3]) } : {})
          }
        }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}
