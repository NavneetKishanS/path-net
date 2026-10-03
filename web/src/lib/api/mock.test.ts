import { describe, expect, it } from 'vitest'
import { createMockClient } from './mock'
import { memoryOverrideStore } from './atlas-client'

describe('mock ApiClient', () => {
  it('loads the pinned slice and reports where it came from', async () => {
    const api = createMockClient(memoryOverrideStore())
    const meta = await api.meta()
    expect(meta.source).toBe('mock')
    expect(meta.counts.nodes).toBe(54)
    expect(meta.sourceCommit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('applies admin synonyms to search', async () => {
    const api = createMockClient(memoryOverrideStore())
    expect((await api.search('early infantile type 13 test alias')).status).toBe('no_match')
    await api.addSynonym('dis_scn8a', 'early infantile type 13 test alias')
    const r = await api.search('early infantile type 13 test alias')
    expect(r.status === 'ok' && r.matches[0]!.node.id).toBe('dis_scn8a')
  })

  it('records review decisions and can undo them', async () => {
    const api = createMockClient(memoryOverrideStore())
    const [item] = await api.getReviewQueue()
    await api.reviewEdge(item!.edge.id, 'approved')
    expect((await api.getReviewQueue()).find((i) => i.edge.id === item!.edge.id)?.decision).toBe('approved')
    await api.reviewEdge(item!.edge.id, null)
    expect((await api.getReviewQueue()).find((i) => i.edge.id === item!.edge.id)?.decision).toBeNull()
  })
})
