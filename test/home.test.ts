import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import type { Content } from '../src/contents'

test('home sorts dated notes newest first and keeps notes without modification dates last', async () => {
  const note = (name: string, modified: Content['modified']): Content => ({
    name,
    slug: name,
    title: name,
    body: '',
    rawData: null,
    created: null,
    modified,
    isRandom: true,
    isArchived: false,
    isPinned: false,
    isIntermediate: false
  })
  const contents = [
    note('unknown-1', null),
    note('unknown-2', null),
    note('older', { year: 2025, month: 1, day: 1 }),
    note('newer', { year: 2026, month: 9, day: 27 })
  ]
  const dataUrl = `data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify({ contents, metaData: {} })}`)}`
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === 'virtual:content-data'
        ? { url: dataUrl, shortCircuit: true }
        : nextResolve(specifier, context)
    }
  })
  try {
    const { loader } = await import('../app/routes/home')
    const result = await loader()
    assert.deepEqual(
      result.subContents.map((item) => item.name),
      ['newer', 'older', 'unknown-1', 'unknown-2']
    )
    assert.deepEqual(result.mainContents, [])
  } finally {
    hooks.deregister()
  }
})
