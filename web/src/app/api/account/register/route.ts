import { accountJson, accountResponse, limitAccountAttempts, readAccountBody, sessionCookie } from '@/lib/server/account-http'
import { registerAccount } from '@/lib/server/account-service'
import { validateRegister } from '@/lib/server/account-validation'

export const runtime = 'nodejs'
export function POST(request: Request) {
  return accountResponse(async () => {
    limitAccountAttempts(request, 'register')
    const input = validateRegister(await readAccountBody(request))
    const result = await registerAccount(input)
    return accountJson(result.session, { status: 201, cookie: sessionCookie(request, result.token) })
  })
}
