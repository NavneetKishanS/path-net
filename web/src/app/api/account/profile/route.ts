import { accountJson, accountResponse, readAccountBody } from '@/lib/server/account-http'
import { getAccountSession, updateAccountProfile } from '@/lib/server/account-service'
import { AccountError, profileFromBody } from '@/lib/server/account-validation'

export const runtime = 'nodejs'
export function PATCH(request: Request) {
  return accountResponse(async () => {
    const body = await readAccountBody(request)
    const session = await getAccountSession(request)
    if (!session.user) throw new AccountError(401, 'Sign in to save your workspace.')
    return accountJson(await updateAccountProfile(request, profileFromBody(body, session.user.role === 'admin')))
  })
}
