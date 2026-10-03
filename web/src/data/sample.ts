// SAMPLE records. Not real sources, not real claims. They exist only to demonstrate a flow
// the pinned slice cannot show, and every one is labelled "Sample" in the UI.
import type { EdgeRow } from '@/types'

export const SAMPLE_EDGES: EdgeRow[] = [
  {
    id: 'sample_contributed_group_scope',
    src: 'group_familiescn2a',
    dst: 'dis_scn8a',
    type: 'contributed',
    tier: 'D',
    confidence: null,
    stance: 'supports',
    status: 'unverified',
    note: 'SAMPLE contribution for the review demo: a user suggests this group also welcomes families with SCN8A changes. No source is attached, so it cannot be approved as evidence.',
  },
]
