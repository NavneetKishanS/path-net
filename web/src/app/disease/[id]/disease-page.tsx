'use client'

import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { Page } from '@/components/layout/page'
import { DiseaseOverview } from '@/components/atlas/disease-overview'
import { CommunityFinder } from '@/components/atlas/community-finder'

export function DiseasePage({ id }: { id: string }) {
  const { role } = useRole()
  if (role === 'patient') {
    return (
      <Page narrow>
        <CommunityFinder diseaseId={id} />
      </Page>
    )
  }
  return (
    <Page>
      <DiseaseOverview
        id={id}
        note={
          role === 'leader' && (
            <p className="mb-5 text-label text-ink-2">
              Is this the condition your group serves?{' '}
              <AppLink href={`/?focus=${id}`} className="link" data-testid="set-focus">
                Make it your home
              </AppLink>
            </p>
          )
        }
      />
    </Page>
  )
}
