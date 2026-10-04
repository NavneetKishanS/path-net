import { AccountError } from './account-validation'
import { SESSION_COOKIE, SESSION_SECONDS } from './account-service'

const MAX_BODY_BYTES = 16 * 1024
const RATE_WINDOW_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; started: number }>()

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const url = new URL(request.url)
  // Next's native dev server can normalize request.url to its bind hostname.
  // Host retains the actual browser origin; browsers cannot override this header.
  const host = request.headers.get('host')
  const expectedOrigin = host ? `${url.protocol}//${host}` : url.origin
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expectedOrigin)) {
    throw new AccountError(403, 'Open PathNet directly to update your account.')
  }
}

export function limitAccountAttempts(request: Request, operation: 'register' | 'login') {
  // Only trust client address headers when an operator explicitly configured a trusted proxy.
  const address = process.env.PATHNET_ACCOUNT_TRUST_PROXY === 'true'
    ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'shared'
    : 'shared'
  const key = `${operation}:${address}`
  const now = Date.now()
  if (attempts.size > 10000) {
    for (const [name, value] of attempts) if (now - value.started >= RATE_WINDOW_MS) attempts.delete(name)
  }
  const value = attempts.get(key)
  if (!value || now - value.started >= RATE_WINDOW_MS) {
    attempts.set(key, { count: 1, started: now })
    return
  }
  value.count += 1
  if (value.count > (operation === 'register' ? 20 : 60)) throw new AccountError(429, 'Too many account attempts. Please try again in 15 minutes.')
}

export async function readAccountBody(request: Request): Promise<unknown> {
  assertSameOrigin(request)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AccountError(415, 'Send account details as JSON.')
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new AccountError(413, 'Account details are too large.')
  if (!request.body) throw new AccountError(400, 'Provide your account details.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      size += item.value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new AccountError(413, 'Account details are too large.')
      }
      chunks.push(item.value)
    }
    const buffer = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder().decode(buffer)) as unknown
  } catch (error) {
    if (error instanceof AccountError) throw error
    throw new AccountError(400, 'Provide valid account details.')
  } finally { reader.releaseLock() }
}

export function sessionCookie(request: Request, token: string | null): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token ?? ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure}`
}

export function accountJson(payload: unknown, options: { status?: number; cookie?: string } = {}) {
  return Response.json(payload, { status: options.status ?? 200, headers: {
    'cache-control': 'private, no-store', vary: 'Cookie',
    'x-content-type-options': 'nosniff',
    ...(options.cookie ? { 'set-cookie': options.cookie } : {}),
  } })
}

export async function accountResponse(work: () => Promise<Response>): Promise<Response> {
  try { return await work() } catch (error) {
    if (error instanceof AccountError) return accountJson({ error: error.message }, { status: error.status })
    // Never send raw SQL errors, password hashes, connection strings, or session tokens.
    return accountJson({ error: 'Account storage is temporarily unavailable. Please try again.' }, { status: 503 })
  }
}
