import { accountJson, accountResponse } from '@/lib/server/account-http'
import { readAccountGraph } from '@/lib/server/account-service'
import { validateGraphResource } from '@/lib/server/account-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return accountResponse(async () => {
    const resource = validateGraphResource(new URL(request.url).searchParams.get('resource'))
    return accountJson(await readAccountGraph(request, resource))
  })
}
