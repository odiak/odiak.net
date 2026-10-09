// Cloudflare Access がリクエストに付与する JWT（Cf-Access-Jwt-Assertion）を検証する。
// Access の設定漏れや workers.dev 経由のアクセスでも保護が外れないよう、Worker 側でも確認する。
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

export type AccessConfig = {
  teamDomain: string
  aud: string
}

type Jwk = { kid?: string; kty?: string; n?: string; e?: string }

const certsTtlMs = 10 * 60 * 1000
const certsCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>()

export async function verifyAccessRequest(
  request: Request,
  config: Partial<AccessConfig>,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (token == null || !config.teamDomain || !config.aud) return false

  return verifyAccessJwt(token, { teamDomain: config.teamDomain, aud: config.aud }, fetchFn)
}

export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [encodedHeader, encodedPayload, encodedSignature] = parts

    const header = JSON.parse(decodeBase64UrlText(encodedHeader))
    const payload = JSON.parse(decodeBase64UrlText(encodedPayload))
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false

    const issuer = `https://${normalizeTeamDomain(config.teamDomain)}`
    const jwk = await findKey(issuer, header.kid, fetchFn)
    if (jwk == null) return false

    const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e },
      algorithm,
      false,
      ['verify']
    )
    const isValidSignature = await crypto.subtle.verify(
      algorithm,
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    )
    if (!isValidSignature) return false

    const now = Date.now() / 1000
    const audiences: unknown[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    return (
      payload.iss === issuer &&
      audiences.includes(config.aud) &&
      typeof payload.exp === 'number' &&
      payload.exp > now &&
      (payload.nbf == null || payload.nbf <= now)
    )
  } catch (error) {
    console.error('Failed to verify Cloudflare Access JWT', error)
    return false
  }
}

async function findKey(
  issuer: string,
  kid: string,
  fetchFn: typeof fetch
): Promise<Jwk | undefined> {
  const cached = certsCache.get(issuer)
  const isFresh = cached != null && Date.now() - cached.fetchedAt < certsTtlMs
  const cachedKey = isFresh ? cached.keys.find((key) => key.kid === kid) : undefined
  if (cachedKey != null) return cachedKey

  // 鍵のローテーション直後は kid が見つからないので取り直す
  const response = await fetchFn(`${issuer}/cdn-cgi/access/certs`)
  if (!response.ok) throw new Error(`Failed to fetch Access certs: HTTP ${response.status}`)
  const { keys } = (await response.json()) as { keys: Jwk[] }
  certsCache.set(issuer, { keys, fetchedAt: Date.now() })
  return keys.find((key) => key.kid === kid)
}

function normalizeTeamDomain(teamDomain: string): string {
  return teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function decodeBase64UrlText(value: string): string {
  return new TextDecoder().decode(decodeBase64Url(value))
}
