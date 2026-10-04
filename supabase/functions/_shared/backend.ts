import type { PlatformRole } from '../../../contract/platform.ts'
import type { EdgeRow, EvidenceRow, GraphSlice, NodeRow } from './core.ts'
import { ROLES } from './core.ts'
import { fetchTimeout, HttpError } from './http.ts'
import type { Env, Fetcher } from './http.ts'

export class Backend {
  url: string
  headers: Record<string, string>
  fetcher: Fetcher
  token: string | null
  constructor(env: Env, request: Request, fetcher: Fetcher) {
    const url = env('SUPABASE_URL')
    const key = env('SUPABASE_ANON_KEY')
    if (!url || !key) throw new HttpError(503, 'platform_unconfigured', 'Configure the platform connection before using this endpoint.')
    this.url = url.replace(/\/$/, '')
    this.fetcher = fetcher
    const auth = request.headers.get('authorization')
    if (auth && !/^Bearer [^\s]+$/i.test(auth)) throw new HttpError(401, 'invalid_token', 'A valid bearer token is required.')
    this.token = auth ? auth.substring(7) : null
    if (this.token === key) this.token = null
    // Every graph/cache/role read is scoped to the actual caller. Never use service_role.
    this.headers = { apikey: key, Authorization: `Bearer ${this.token || key}` }
  }
  async rows<T>(table: string, query = 'select=*', optional = false): Promise<T[]> {
    let result: Response
    try { result = await fetchTimeout(this.fetcher, `${this.url}/rest/v1/${table}?${query}`, { headers: this.headers }) }
    catch (error) { if (optional) return []; throw error }
    if (!result.ok) {
      if (optional && result.status !== 401) return []
      throw new HttpError(result.status === 401 ? 401 : 503, result.status === 401 ? 'invalid_token' : 'database_unavailable', result.status === 401 ? 'The session is invalid or expired.' : 'The graph service is unavailable.')
    }
    let rows: unknown
    try { rows = await result.json() } catch (error) { if (optional) return []; throw error }
    if (!Array.isArray(rows)) { if (optional) return []; throw new Error('invalid_database_response') }
    return rows as T[]
  }
  async identity(required = false): Promise<{ userId: string | null; role: PlatformRole }> {
    if (!this.token) {
      if (required) throw new HttpError(401, 'authentication_required', 'Sign in before extracting an abstract.')
      return { userId: null, role: 'family' }
    }
    const result = await fetchTimeout(this.fetcher, `${this.url}/auth/v1/user`, { headers: this.headers })
    if (!result.ok) throw new HttpError(401, 'invalid_token', 'The session is invalid or expired.')
    const user = await result.json() as { id?: unknown }
    if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) throw new HttpError(401, 'invalid_token', 'The session is invalid or expired.')
    const rows = await this.rows<{ role: string }>('user_roles', `select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`)
    const role = rows[0]?.role
    return { userId: user.id, role: ROLES.includes(role as PlatformRole) ? role as PlatformRole : 'family' }
  }
  async all<T>(table: string): Promise<T[]> {
    const collected: T[] = []
    // Explicit pagination avoids PostgREST's usual 1,000-row truncation; fail if oversized.
    const pageSize = 500
    for (let offset = 0; offset <= 10000; offset += pageSize) {
      const page = await this.rows<T>(table, `select=*&order=id.asc&limit=${pageSize}&offset=${offset}`)
      if (offset + page.length > 10000) throw new HttpError(503, 'slice_too_large', 'This graph exceeds the supported prototype slice size.')
      collected.push(...page)
      if (page.length < pageSize) return collected
    }
    throw new Error('pagination_limit')
  }
  async graph(): Promise<GraphSlice> {
    const [nodes, edges, evidence] = await Promise.all([this.all<NodeRow>('nodes'), this.all<EdgeRow>('edges'), this.all<EvidenceRow>('evidence')])
    return { nodes, edges, evidence }
  }
  async coverage(): Promise<Record<string, unknown>> {
    const rows = await this.rows<{ payload: Record<string, unknown> }>('coverage_cache', 'select=payload&cache_key=eq.p1-slice-v1&limit=1', true)
    return rows[0]?.payload || {}
  }
}
