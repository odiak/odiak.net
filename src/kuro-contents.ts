import path from 'node:path'
import matter from 'gray-matter'
import { isPublishedImagePath } from './images'

type NoteStat = { path: string; mtime: number | null; size: number | null }
export type DownloadedNote = { name: string; sourcePath: string; content: string }
export type DownloadedImage = { sourcePath: string; bytes: Uint8Array }

function kuroRequester(token: string, fetcher: typeof fetch) {
  return async function request(endpoint: string) {
    const response = await fetcher(new URL(endpoint, 'https://usekuro.app'), {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) throw new Error(`Kuro article download failed: HTTP ${response.status}`)
    return response
  }
}

function isSafePublicPath(vaultPath: string): boolean {
  return (
    vaultPath.startsWith('public/') &&
    !/[\\\x00-\x1f\x7f]/.test(vaultPath) &&
    vaultPath.split('/').every((part) => part && part !== '.' && part !== '..')
  )
}

/** Images under public/images/; other attachments are not published. */
export async function fetchKuroImages(
  token: string,
  fetcher: typeof fetch = fetch
): Promise<DownloadedImage[]> {
  const request = kuroRequester(token, fetcher)
  const listing = (await (await request('/api/notes/attachments')).json()) as {
    pathPrefix: string
    files: NoteStat[]
  }
  if (listing.pathPrefix !== 'public/') {
    throw new Error('The Kuro token must be restricted to public/')
  }
  if (!Array.isArray(listing.files)) throw new Error('Kuro returned no attachment listing')
  const result: DownloadedImage[] = []
  for (const file of listing.files) {
    if (!isSafePublicPath(file.path)) throw new Error(`Unexpected attachment path: ${file.path}`)
    if (!isPublishedImagePath(file.path)) continue
    const query = new URLSearchParams({ path: file.path })
    const response = await request(`/api/notes/attachment?${query}`)
    result.push({ sourcePath: file.path, bytes: new Uint8Array(await response.arrayBuffer()) })
  }
  return result
}

/** Fetch everything before replacing the last successful local download. */
export async function fetchKuroContents(
  token: string,
  fetcher: typeof fetch = fetch
): Promise<DownloadedNote[]> {
  const request = kuroRequester(token, fetcher)

  const listing = (await (await request('/api/notes')).json()) as {
    pathPrefix: string
    notes: NoteStat[]
  }
  if (listing.pathPrefix !== 'public/') {
    throw new Error('The Kuro token must be restricted to public/')
  }
  if (!Array.isArray(listing.notes) || listing.notes.length === 0) {
    throw new Error('Kuro returned no public notes; refusing to build an empty site')
  }
  const sources = new Map<string, string>()
  const notes = listing.notes.map((note) => {
    if (!isSafePublicPath(note.path) || !note.path.endsWith('.md')) {
      throw new Error(`Unexpected note path: ${note.path}`)
    }
    const name = path.posix.basename(note.path, '.md')
    if (!name) throw new Error(`Missing article name: ${note.path}`)
    const key = name.toLowerCase()
    if (sources.has(key)) {
      throw new Error(`Duplicate article name: ${sources.get(key)} and ${note.path}`)
    }
    sources.set(key, note.path)
    return { ...note, name }
  })

  const result: DownloadedNote[] = []
  for (const note of notes) {
    const query = new URLSearchParams({ path: note.path })
    const data = (await (await request(`/api/notes/content?${query}`)).json()) as {
      path: string
      content: string
    }
    if (data.path !== note.path || typeof data.content !== 'string') {
      throw new Error(`Missing or incomplete note: ${note.path}`)
    }
    const parsed = matter(data.content)
    if (note.mtime !== null) {
      if (!Number.isFinite(note.mtime)) throw new Error(`Invalid modification time: ${note.path}`)
      parsed.data.fileModified = new Date(note.mtime)
    }
    result.push({
      name: note.name,
      sourcePath: note.path,
      content: matter.stringify(parsed.content, parsed.data)
    })
  }
  return result
}
