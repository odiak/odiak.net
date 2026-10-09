import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkHtml from 'remark-html'
import {
  imageUrl,
  isPublishedImagePath,
  resolveEmbedTarget,
  resolveImageUrl,
  rewriteImageEmbeds
} from '../src/images'
import { remarkImageSize } from '../src/markdown-image-size'

const images = new Set([
  'public/images/foo.png',
  'public/images/a (1) b.JPG',
  'public/images/2026/foo.png',
  'public/images/nested/bar.webp'
])

test('publishes only images under public/images/', () => {
  assert.equal(isPublishedImagePath('public/images/x.PNG'), true)
  assert.equal(isPublishedImagePath('public/images/sub/x.svg'), true)
  assert.equal(isPublishedImagePath('public/images/x.pdf'), false)
  assert.equal(isPublishedImagePath('public/x.png'), false)
})

test('encodes every segment of image URLs', () => {
  assert.equal(imageUrl('public/images/a (1) b.JPG'), '/images/a%20%281%29%20b.JPG')
  assert.equal(imageUrl('public/images/2026/日本.png'), '/images/2026/%E6%97%A5%E6%9C%AC.png')
})

test('resolves Markdown image URLs relative to the note or the vault root', () => {
  assert.equal(
    resolveImageUrl('./images/foo.png', 'public/post.md', images),
    'public/images/foo.png'
  )
  assert.equal(
    resolveImageUrl('images/a%20(1)%20b.JPG', 'public/post.md', images),
    'public/images/a (1) b.JPG'
  )
  assert.equal(
    resolveImageUrl('../images/foo.png', 'public/sub/post.md', images),
    'public/images/foo.png'
  )
  assert.equal(
    resolveImageUrl('public/images/foo.png', 'public/sub/post.md', images),
    'public/images/foo.png'
  )
  for (const url of ['/images/foo.png', 'https://example.com/foo.png', './images/none.png', '#x']) {
    assert.equal(resolveImageUrl(url, 'public/post.md', images), undefined)
  }
})

test('resolves embeds by path, then by file name', () => {
  assert.equal(
    resolveEmbedTarget('bar.webp', 'public/post.md', images),
    'public/images/nested/bar.webp'
  )
  assert.equal(
    resolveEmbedTarget('BAR.webp', 'public/post.md', images),
    'public/images/nested/bar.webp'
  )
  // Several files share the name: the path wins, otherwise the first in sorted order.
  assert.equal(
    resolveEmbedTarget('images/2026/foo.png', 'public/post.md', images),
    'public/images/2026/foo.png'
  )
  assert.equal(
    resolveEmbedTarget('foo.png', 'public/post.md', images),
    'public/images/2026/foo.png'
  )
  assert.equal(resolveEmbedTarget('none.png', 'public/post.md', images), undefined)
})

test('rewrites image embeds outside code, keeping sizes and unknown embeds', () => {
  const markdown = [
    'Look ![[bar.webp]] and ![[a (1) b.JPG|300]] or ![[bar.webp|300x200]]',
    '![[missing.png]] ![[Other note]] ![[bar.webp|caption]]',
    '`![[bar.webp]]`',
    '```',
    '![[bar.webp]]',
    '```'
  ].join('\n')
  assert.equal(
    rewriteImageEmbeds(markdown, 'public/post.md', images),
    [
      'Look ![bar](/images/nested/bar.webp) and ![a (1) b|300](/images/a%20%281%29%20b.JPG) or ![bar|300x200](/images/nested/bar.webp)',
      '![[missing.png]] ![[Other note]] ![bar](/images/nested/bar.webp)',
      '`![[bar.webp]]`',
      '```',
      '![[bar.webp]]',
      '```'
    ].join('\n')
  )
})

test('renders sizes from the alt text', () => {
  const html = unified()
    .use(remarkParse)
    .use(remarkImageSize)
    .use(remarkHtml)
    .processSync('![a|300](/x.png) ![b|30x20](/y.png) ![c|d](/z.png)')
    .toString()
  assert.equal(
    html.trim(),
    '<p><img src="/x.png" alt="a" width="300"> <img src="/y.png" alt="b" width="30" height="20"> <img src="/z.png" alt="c|d"></p>'
  )
})
