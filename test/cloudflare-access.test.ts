import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyAccessJwt, verifyAccessRequest } from '../src/cloudflare-access'

const aud = 'test-aud'

async function setup(teamDomain: string) {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'key-1' }
  const fetchFn = (async (url: string) => {
    assert.equal(url, `https://${teamDomain}/cdn-cgi/access/certs`)
    return Response.json({ keys: [jwk] })
  }) as typeof fetch

  const sign = async (payload: Record<string, unknown>, kid = 'key-1') => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const data = `${encode({ alg: 'RS256', kid })}.${encode(payload)}`
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(data)
    )
    return `${data}.${Buffer.from(signature).toString('base64url')}`
  }

  const now = Math.floor(Date.now() / 1000)
  const validPayload = { iss: `https://${teamDomain}`, aud: [aud], exp: now + 60, nbf: now - 60 }
  return { fetchFn, sign, validPayload, now }
}

test('accepts a token signed by Access for the configured application', async () => {
  const teamDomain = 'valid.cloudflareaccess.com'
  const { fetchFn, sign, validPayload } = await setup(teamDomain)
  const token = await sign(validPayload)

  assert.equal(await verifyAccessJwt(token, { teamDomain, aud }, fetchFn), true)
  assert.equal(
    await verifyAccessJwt(token, { teamDomain: `https://${teamDomain}/`, aud }, fetchFn),
    true
  )
})

test('rejects tokens with wrong audience, issuer, expiry, key, or signature', async () => {
  const teamDomain = 'invalid.cloudflareaccess.com'
  const { fetchFn, sign, validPayload, now } = await setup(teamDomain)
  const config = { teamDomain, aud }

  const cases = [
    await sign({ ...validPayload, aud: ['other-aud'] }),
    await sign({ ...validPayload, iss: 'https://other.cloudflareaccess.com' }),
    await sign({ ...validPayload, exp: now - 1 }),
    await sign({ ...validPayload, nbf: now + 60 }),
    await sign(validPayload, 'unknown-key'),
    (await sign(validPayload)).replace(/\.[^.]+$/, '.AAAA'),
    'not-a-jwt'
  ]
  for (const token of cases) {
    assert.equal(await verifyAccessJwt(token, config, fetchFn), false, token)
  }
})

test('rejects requests without the Access header or configuration', async () => {
  const teamDomain = 'request.cloudflareaccess.com'
  const { fetchFn, sign, validPayload } = await setup(teamDomain)
  const token = await sign(validPayload)
  const withToken = new Request('https://odiak.net/update', {
    headers: { 'Cf-Access-Jwt-Assertion': token }
  })

  assert.equal(await verifyAccessRequest(withToken, { teamDomain, aud }, fetchFn), true)
  assert.equal(
    await verifyAccessRequest(
      new Request('https://odiak.net/update'),
      { teamDomain, aud },
      fetchFn
    ),
    false
  )
  assert.equal(await verifyAccessRequest(withToken, { teamDomain }, fetchFn), false)
})
