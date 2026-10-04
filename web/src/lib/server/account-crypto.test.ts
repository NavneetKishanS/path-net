import { describe, expect, it } from 'vitest'
import { createSessionToken, hashPassword, hashSessionToken, isSessionToken, verifyPassword } from './account-crypto'

describe('native account credentials', () => {
  it('salts password hashes and verifies without storing the password', async () => {
    const first = await hashPassword('correct-horse-battery-staple')
    const second = await hashPassword('correct-horse-battery-staple')
    expect(first).not.toBe(second)
    expect(first).not.toContain('correct-horse')
    expect(await verifyPassword('correct-horse-battery-staple', first)).toBe(true)
    expect(await verifyPassword('incorrect', first)).toBe(false)
    expect(await verifyPassword('incorrect', 'scrypt$999999999$8$1$ab$cd')).toBe(false)
  })

  it('uses random opaque cookies and stores only their digest', () => {
    const first = createSessionToken()
    expect(isSessionToken(first)).toBe(true)
    expect(createSessionToken()).not.toBe(first)
    expect(hashSessionToken(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashSessionToken(first)).not.toBe(first)
    expect(isSessionToken('forged-cookie')).toBe(false)
  })
})
