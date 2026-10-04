import { accountJson, accountResponse, assertSameOrigin, sessionCookie } from '@/lib/server/account-http'
import { logoutAccount } from '@/lib/server/account-service'

export const runtime = 'nodejs'
export function POST(request: Request) {
  return accountResponse(async () => {
    assertSameOrigin(request)
    return accountJson(await logoutAccount(request), { cookie: sessionCookie(request, null) })
  })
}
