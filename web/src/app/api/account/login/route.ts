import { accountJson, accountResponse, limitAccountAttempts, readAccountBody, sessionCookie } from '@/lib/server/account-http'
import { loginAccount, sessionTokenFromRequest } from '@/lib/server/account-service'
import { validateLogin } from '@/lib/server/account-validation'

export const runtime = 'nodejs'
export function POST(request: Request) {
  return accountResponse(async () => {
    limitAccountAttempts(request, 'login')
    const input = validateLogin(await readAccountBody(request))
    const result = await loginAccount(input, sessionTokenFromRequest(request))
    return accountJson(result.session, { cookie: sessionCookie(request, result.token) })
  })
}
