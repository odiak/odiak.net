import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { fetchKuroContents, fetchKuroImages } from '../src/kuro-contents'

const token = 'test-token'
const stats = [
  { path: 'public/First.md', mtime: 1_700_000_000_000, size: 12 },
  { path: 'public/nested/日本語.md', mtime: null, size: 0 }
]

test('downloads nested Markdown with Bearer auth, dates and original frontmatter', async () => {
  const calls: string[] = []
  const fetcher: typeof fetch = async (input, options) => {
    const url = new URL(String(input))
    calls.push(url.href)
    assert.equal(url.origin, 'https://usekuro.app')
    assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${token}`)
    assert.equal(options?.redirect, 'error')
    if (url.pathname === '/api/notes') return Response.json({ pathPrefix: 'public/', notes: stats })
    const notePath = url.searchParams.get('path')!
    return Response.json({
      path: notePath,
      content:
        notePath === stats[0].path
          ? '---\ncreated: 2020-01-02\nslug: first\nfileCreated: 2019-01-01\n---\n# Hello\n'
          : ''
    })
  }
  const notes = await fetchKuroContents(token, fetcher)
  assert.deepEqual(
    notes.map((n) => n.name),
    ['First', '日本語']
  )
  const first = matter(notes[0].content)
  assert.equal(first.data.created.toISOString(), '2020-01-02T00:00:00.000Z')
  assert.equal(first.data.fileCreated.toISOString(), '2019-01-01T00:00:00.000Z')
  assert.equal(first.data.fileModified.toISOString(), '2023-11-14T22:13:20.000Z')
  assert.equal(matter(notes[1].content).data.fileCreated, undefined)
  assert.equal(new URL(calls[2]).searchParams.get('path'), stats[1].path)
})

test('rejects a token with a broader or different scope', async () => {
  const fetcher: typeof fetch = async () => Response.json({ pathPrefix: '', notes: stats })
  await assert.rejects(fetchKuroContents(token, fetcher), /restricted to public/)
})

test('fails on authentication errors, missing content and empty listings', async () => {
  await assert.rejects(
    fetchKuroContents(token, async () => new Response('', { status: 401 })),
    /HTTP 401/
  )
  await assert.rejects(
    fetchKuroContents(token, async () => Response.json({ pathPrefix: 'public/', notes: [] })),
    /no public notes/
  )
  const fetcher: typeof fetch = async (input) =>
    new URL(String(input)).pathname === '/api/notes'
      ? Response.json({ pathPrefix: 'public/', notes: stats })
      : Response.json({ path: stats[0].path, content: null })
  await assert.rejects(fetchKuroContents(token, fetcher), /incomplete note/)
})

test('rejects duplicate basenames before fetching bodies', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      pathPrefix: 'public/',
      notes: [stats[0], { ...stats[0], path: 'public/nested/first.md' }]
    })
  await assert.rejects(fetchKuroContents(token, fetcher), /Duplicate article name/)
})

test('rejects unsafe or non-public paths', async () => {
  for (const notePath of [
    'private/x.md',
    'public/../x.md',
    'public//x.md',
    'public/x\\y.md',
    'public/image.png'
  ]) {
    const fetcher: typeof fetch = async () =>
      Response.json({ pathPrefix: 'public/', notes: [{ ...stats[0], path: notePath }] })
    await assert.rejects(fetchKuroContents(token, fetcher), /Unexpected note path/)
  }
})

test('downloads only images under public/images/ as bytes', async () => {
  const requested: string[] = []
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/notes/attachments') {
      return Response.json({
        pathPrefix: 'public/',
        files: [
          { path: 'public/images/a.png', mtime: 1, size: 3 },
          { path: 'public/images/doc.pdf', mtime: 1, size: 3 },
          { path: 'public/other.png', mtime: 1, size: 3 }
        ]
      })
    }
    requested.push(url.searchParams.get('path')!)
    return new Response(new Uint8Array([1, 2, 3]))
  }
  assert.deepEqual(await fetchKuroImages(token, fetcher), [
    { sourcePath: 'public/images/a.png', bytes: new Uint8Array([1, 2, 3]) }
  ])
  assert.deepEqual(requested, ['public/images/a.png'])

  for (const filePath of ['private/images/a.png', 'public/images/../a.png']) {
    const unsafe: typeof fetch = async () =>
      Response.json({ pathPrefix: 'public/', files: [{ path: filePath, mtime: 1, size: 1 }] })
    await assert.rejects(fetchKuroImages(token, unsafe), /Unexpected attachment path/)
  }
  await assert.rejects(
    fetchKuroImages(token, async () => Response.json({ pathPrefix: '', files: [] })),
    /restricted to public/
  )
})

test('download CLI preserves URLs and nested wiki links, and keeps old files on fetch failure', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const cwd = await mkdtemp(path.join(tmpdir(), 'odiak-kuro-test-'))
  let fail = false
  const server = createServer((req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${token}`)
    const url = new URL(req.url!, 'http://localhost')
    res.setHeader('Content-Type', 'application/json')
    if (fail) {
      res.writeHead(503).end('{}')
    } else if (url.pathname === '/api/notes/attachments') {
      res.end(
        JSON.stringify({
          pathPrefix: 'public/',
          files: [{ path: 'public/images/sub/a b.png', mtime: 1, size: 3 }]
        })
      )
    } else if (url.pathname === '/api/notes/attachment') {
      assert.equal(url.searchParams.get('path'), 'public/images/sub/a b.png')
      res.setHeader('Content-Type', 'image/png')
      res.end(Buffer.from([1, 2, 3]))
    } else if (url.pathname === '/api/notes') {
      res.end(JSON.stringify({ pathPrefix: 'public/', notes: stats }))
    } else {
      const notePath = url.searchParams.get('path')
      res.end(
        JSON.stringify({
          path: notePath,
          content:
            notePath === stats[0].path
              ? '---\nslug: first\ncreated: 2020-01-02\n---\n[[public/nested/日本語]]\n[[private/日本語]]\n[[missing/日本語]]\n[[public/missing/日本語]]\n[[public/missing/日本語.md:未解決]]\n[[private/First]]\n'
              : '---\nslug: japanese\n---\n[[public/First:表示名]]\n\n![[a b.png|300]]\n\n![図](../images/sub/a%20b.png)\n'
        })
      )
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const preload = path.join(cwd, 'mock-fetch.mjs')
  await writeFile(
    preload,
    `
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input, options) => {
      const url = new URL(input);
      if (url.origin !== 'https://usekuro.app') throw new Error('Unexpected Kuro origin');
      return originalFetch(new URL(url.pathname + url.search, 'http://127.0.0.1:${address.port}'), options);
    };
  `
  )
  const env = {
    ...process.env,
    KURO_API_TOKEN: token
  }
  const run = () =>
    promisify(execFile)(
      process.execPath,
      [
        '--import',
        preload,
        '--import',
        path.join(root, 'node_modules/tsx/dist/loader.mjs'),
        path.join(root, 'src/download-contents.ts')
      ],
      { cwd, env }
    )
  try {
    await mkdir(path.join(cwd, 'contents'))
    await writeFile(path.join(cwd, 'contents/stale.md'), 'stale')
    await mkdir(path.join(cwd, 'public/images'), { recursive: true })
    await writeFile(path.join(cwd, 'public/images/stale.png'), 'stale')
    await run()
    assert.deepEqual(
      await readFile(path.join(cwd, 'public/images/sub/a b.png')),
      Buffer.from([1, 2, 3])
    )
    await assert.rejects(readFile(path.join(cwd, 'public/images/stale.png')))
    const japaneseBody = await readFile(path.join(cwd, 'contents/日本語.md'), 'utf8')
    assert.ok(japaneseBody.includes('![a b|300](/images/sub/a%20b.png)'))
    assert.ok(japaneseBody.includes('![図](/images/sub/a%20b.png)'))
    assert.match(await readFile(path.join(cwd, 'contents/First.md'), 'utf8'), /\[\[日本語\]\]/)
    const metadata = JSON.parse(await readFile(path.join(cwd, 'contents/metadata.json'), 'utf8'))
    assert.equal(metadata.nameToSlugMap.First, 'first')
    assert.equal(metadata.nameToSlugMap['日本語'], 'japanese')
    assert.equal(metadata.nameToLinksMap.First.outgoing[0].name, '日本語')
    assert.equal(metadata.nameToLinksMap['日本語'].outgoing[0].name, 'First')
    assert.deepEqual(
      metadata.nameToLinksMap.First.outgoing.map((link: { name: string }) => link.name),
      ['日本語']
    )
    assert.deepEqual(Object.keys(metadata.nameToLinksMap).sort(), ['First', '日本語'])
    const firstBody = await readFile(path.join(cwd, 'contents/First.md'), 'utf8')
    for (const target of [
      'private/日本語',
      'missing/日本語',
      'public/missing/日本語',
      'public/missing/日本語.md:未解決',
      'private/First'
    ]) {
      assert.ok(firstBody.includes(`[[${target}]]`))
      assert.equal(metadata.nameToSlugMap[target], undefined)
    }

    assert.match(
      await readFile(path.join(cwd, 'contents/日本語.md'), 'utf8'),
      /\[\[First:表示名\]\]/
    )
    await assert.rejects(readFile(path.join(cwd, 'contents/stale.md')))
    const before = await readFile(path.join(cwd, 'contents/First.md'), 'utf8')
    fail = true
    await assert.rejects(run(), /HTTP 503/)
    assert.equal(await readFile(path.join(cwd, 'contents/First.md'), 'utf8'), before)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(cwd, { recursive: true, force: true })
  }
})
