// Mock adapter: the pinned P1 slice (src/data/slice), loaded as a separate chunk.
import type { Graph } from '@/types'
import { SAMPLE_EDGES } from '@/data/sample'
import type { CoverageFile } from '@/lib/engine/atlas'
import type { PubmedTitles } from '@/lib/engine/build'
import { AtlasApiClient, type OverrideStore } from './atlas-client'

export function createMockClient(store?: OverrideStore) {
  return new AtlasApiClient(async () => {
    const [graph, coverage, titles, pin] = await Promise.all([
      import('@/data/slice/graph.json'),
      import('@/data/slice/coverage.json'),
      import('@/data/slice/pubmed-titles.json'),
      import('@/data/slice/pin.json'),
    ])
    return {
      graph: graph.default as unknown as Graph,
      coverage: coverage.default as CoverageFile,
      titles: titles.default as PubmedTitles,
      sampleEdges: SAMPLE_EDGES,
      meta: {
        source: 'mock',
        label: 'Pinned data slice',
        snapshotDate: pin.default.snapshot_date,
        sourceCommit: pin.default.source_commit,
      },
    }
  }, store)
}
