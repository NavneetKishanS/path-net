export type Env = (name: string) => string | undefined
export type Fetcher = typeof fetch
export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code }
}
export function objectBody(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw new HttpError(400, 'invalid_request', 'Supply only the documented request fields.')
  return value as Record<string, unknown>
}
export function stringField(body: Record<string, unknown>, name: string, max: number, optional = false): string {
  if (optional && body[name] === undefined) return ''
  const value = body[name]
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) throw new HttpError(400, 'invalid_request', `${name} must be a nonempty string of at most ${max} characters.`)
  return value
}
export async function fetchTimeout(fetcher: Fetcher, url: string, init: RequestInit = {}, ms = 10000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try { return await fetcher(url, { ...init, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}
export function endpoint(env: Env, execute: (body: unknown, request: Request) => Promise<unknown>, maxBytes = 70000) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin')
    const allowed = (env('ALLOWED_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim()).filter(Boolean)
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' })
    if (origin && allowed.includes(origin)) {
      headers.set('access-control-allow-origin', origin)
      headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info')
      headers.set('access-control-allow-methods', 'POST, OPTIONS')
    }
    const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
    try {
      if (origin && !allowed.includes(origin)) throw new HttpError(403, 'origin_forbidden', 'This origin is not allowed.')
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      if (request.method !== 'POST') { headers.set('allow', 'POST, OPTIONS'); throw new HttpError(405, 'method_not_allowed', 'Use POST.') }
      if (!request.headers.get('content-type')?.split(';')[0].trim().toLowerCase().endsWith('/json')) throw new HttpError(415, 'unsupported_media_type', 'Use application/json.')
      if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new HttpError(413, 'request_too_large', 'Request is too large.')
      const reader = request.body?.getReader()
      if (!reader) throw new HttpError(400, 'invalid_request', 'A JSON body is required.')
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.length
        if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'request_too_large', 'Request is too large.') }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      let parsed: unknown
      try { parsed = JSON.parse(new TextDecoder().decode(bytes)) }
      catch { throw new HttpError(400, 'invalid_json', 'Body must contain valid JSON.') }
      return response(await execute(parsed, request))
    } catch (error) {
      if (error instanceof HttpError) return response({ error: { code: error.code, message: error.message } }, error.status)
      // Do not expose source text, credentials, upstream response bodies, or stack traces.
      return response({ error: { code: 'upstream_unavailable', message: 'The service could not complete this request. Try again later.' } }, 503)
    }
  }
}
