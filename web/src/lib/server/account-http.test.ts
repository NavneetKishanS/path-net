import { describe, expect, it } from 'vitest'
import { accountResponse, assertSameOrigin, readAccountBody, sessionCookie } from './account-http'

describe('account HTTP boundary', () => {
  it('rejects cross-origin mutations and permits the app origin', () => {
    expect(() => assertSameOrigin(new Request('https://atlas.example/api/account/profile', { headers: { origin: 'https://evil.example' } }))).toThrow()
    expect(() => assertSameOrigin(new Request('https://atlas.example/api/account/profile', { headers: { origin: 'https://atlas.example' } }))).not.toThrow()
    expect(() => assertSameOrigin(new Request('http://localhost:5176/api/account/profile', { headers: { host: '127.0.0.1:5176', origin: 'http://127.0.0.1:5176' } }))).not.toThrow()
    expect(() => assertSameOrigin(new Request('https://atlas.example/api/account/logout', { headers: { 'sec-fetch-site': 'cross-site' } }))).toThrow()
  })

  it('requires bounded JSON requests', async () => {
    await expect(readAccountBody(new Request('http://localhost/api/account/profile', { method: 'POST', body: 'a' }))).rejects.toThrow('JSON')
    await expect(readAccountBody(new Request('http://localhost/api/account/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'a'.repeat(17000) }))).rejects.toThrow('too large')
  })

  it('secures cookies and revokes them on logout', () => {
    expect(sessionCookie(new Request('https://atlas.example'), 'token')).toContain('HttpOnly; SameSite=Lax')
    expect(sessionCookie(new Request('https://atlas.example'), 'token')).toContain('; Secure')
    expect(sessionCookie(new Request('http://localhost'), null)).toContain('Max-Age=0')
  })

  it('does not disclose server connection errors or secrets', async () => {
    const response = await accountResponse(async () => { throw new Error('postgresql://private-password@server') })
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private-password')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
