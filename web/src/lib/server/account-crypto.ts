import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const PARAMETERS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, PARAMETERS, (error, key) => error ? reject(error) : resolve(key))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt)
  return `scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = /^scrypt\$16384\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(encoded)
  if (!match?.[1] || !match[2]) return false
  const actual = await derive(password, Buffer.from(match[1], 'hex'))
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'))
}

export function createSessionToken(): string { return randomBytes(32).toString('base64url') }
export function hashSessionToken(token: string): string { return createHash('sha256').update(token).digest('hex') }
export function isSessionToken(token: string): boolean { return /^[A-Za-z0-9_-]{43}$/.test(token) }
