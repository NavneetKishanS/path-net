'use client'

import { useQueryState } from 'nuqs'
import { Sheet } from '@/components/ui/sheet'
import { useEdge } from '@/lib/queries'
import { edgeParam } from '@/lib/url-state'
import { EvidencePanel } from './evidence-panel'

/** One drawer for the whole app, bound to ?edge=. Any citation marker opens it. */
export function EvidenceDrawer() {
  const [edgeId, setEdgeId] = useQueryState('edge', edgeParam)
  const { edge, from, to, isLoading } = useEdge(edgeId)
  return (
    <Sheet
      open={!!edgeId}
      onOpenChange={(o) => !o && void setEdgeId(null)}
      title="Evidence"
      description={from && to ? `${from.name} and ${to.name}` : undefined}
    >
      {edge && from && to ? (
        <EvidencePanel edge={edge} from={from} to={to} />
      ) : (
        <p className="text-ui text-ink-2">
          {isLoading
            ? 'Loading evidence…'
            : edgeId
              ? 'This link is not in the current data, or it was rejected in review.'
              : null}
        </p>
      )}
    </Sheet>
  )
}
