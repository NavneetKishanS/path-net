import { accountJson, accountResponse } from '@/lib/server/account-http'
import { getAccountSession } from '@/lib/server/account-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return accountResponse(async () => accountJson(await getAccountSession(request)))
}
