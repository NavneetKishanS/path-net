'use client'

import { Gate, Page, PageHeader } from '@/components/layout/page'
import { AdminView } from '@/components/admin/admin-view'

export default function AdminPage() {
  return (
    <Gate panel="admin" what="Administration">
      <Page>
        <PageHeader title="Atlas administration" kicker="Admin">
          Builder status, links waiting for review, synonyms, thresholds and what the sources cover.
        </PageHeader>
        <AdminView />
      </Page>
    </Gate>
  )
}
