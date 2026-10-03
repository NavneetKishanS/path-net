import { describe, expect, it } from 'vitest'
import type { Graph } from '@/types'
import graph from '@/data/slice/graph.json'
import coverage from '@/data/slice/coverage.json'
import titles from '@/data/slice/pubmed-titles.json'
import { SAMPLE_EDGES } from '@/data/sample'
import { Atlas, type CoverageFile } from './atlas'

const make = (decisions: Record<string, 'approved' | 'rejected'> = {}) =>
  new Atlas({
    graph: graph as unknown as Graph,
    coverage: coverage as CoverageFile,
    titles,
    sampleEdges: SAMPLE_EDGES,
    overrides: { decisions, synonyms: {} },
  })

describe('search', () => {
  const atlas = make()

  it('resolves a synonym and says so', () => {
    const r = atlas.search('DEE13')
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.matches[0]!.node.id).toBe('dis_scn8a')
    expect(r.matches[0]!.matchedVia).toEqual({ kind: 'synonym', value: 'DEE13' })
  })

  it('resolves a protein alias to its gene', () => {
    const r = atlas.search('Nav1.6')
    expect(r.status === 'ok' && r.matches[0]!.node.id).toBe('gene_scn8a')
  })

  it('resolves ontology ids', () => {
    const r = atlas.search('MONDO:0013801')
    expect(r.status === 'ok' && r.matches[0]!.matchedVia.kind).toBe('id')
  })

  it('resolves a gene to its disease for plain search', () => {
    const r = atlas.search('STXBP1', { types: ['disease', 'phenotype', 'patientGroup'], resolveGenes: true })
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.matches.map((m) => m.node.id)).toContain('dis_stxbp1')
  })

  it('returns a coverage-backed no-match for terms outside the slice', () => {
    const r = atlas.search('CDKL5')
    expect(r.status).toBe('no_match')
    if (r.status !== 'no_match') return
    expect(r.coverage.genes).toEqual(['STXBP1', 'SCN2A', 'KCNQ2', 'SCN8A'])
    expect(r.coverage.queries.length).toBeGreaterThan(0)
  })
})

describe('inferred links', () => {
  const atlas = make()

  it('derives a shared-mechanism link only from supporting evidence, and lists its sources', () => {
    const inferred = atlas.g.edges.filter((e) => e.relation === 'shares_mechanism_with')
    expect(inferred).toHaveLength(1)
    const e = inferred[0]!
    expect([e.from, e.to].sort()).toEqual(['dis_scn2a_neonatal_epilepsy', 'dis_scn8a'])
    expect(e.basis).toBe('inferred')
    expect(e.tier).toBe('C')
    expect(e.derivedFrom?.sort()).toEqual(['scn2a_neonatal_gof', 'scn8a_dee_gof'])
    expect(e.evidence.every((ev) => ev.url.startsWith('https://pubmed.ncbi.nlm.nih.gov/'))).toBe(true)
  })

  it('never treats a contradicting edge as support', () => {
    const inferred = atlas.g.edges.filter((e) => e.relation === 'shares_mechanism_with')
    expect(inferred.some((e) => e.from === 'dis_scn2a' || e.to === 'dis_scn2a')).toBe(false)
  })

  it('has no inferred edge without the observed edges it came from', () => {
    for (const e of atlas.g.edges.filter((x) => x.basis === 'inferred')) {
      expect(e.derivedFrom?.length).toBeGreaterThanOrEqual(2)
      for (const id of e.derivedFrom!) expect(atlas.edge(id)?.basis).toBe('observed')
    }
  })

  it('gives every observed, non-sample edge at least one evidence row with a URL', () => {
    for (const e of atlas.g.edges.filter((x) => x.basis === 'observed' && !x.sample)) {
      expect(e.evidence.length, e.id).toBeGreaterThan(0)
      expect(
        e.evidence.every((ev) => ev.url !== ''),
        e.id,
      ).toBe(true)
    }
  })
})

describe('connections and routes (Patient Group Leader journey)', () => {
  const atlas = make()

  it('ranks the shared-mechanism condition first for SCN8A', () => {
    const c = atlas.connections('dis_scn8a')
    expect(c[0]!.disease.id).toBe('dis_scn2a_neonatal_epilepsy')
    expect(c[0]!.kind).toBe('mechanism')
    expect(c[0]!.supported).toBe(true)
    expect(c[0]!.communities.map((x) => x.group.id)).toEqual(['group_familiescn2a'])
    expect(c[0]!.communities[0]!.viaParent?.id).toBe('dis_scn2a')
  })

  it('attaches the contradicting SCN2A evidence as a qualifier', () => {
    const c = atlas.connections('dis_scn8a').find((x) => x.disease.id === 'dis_scn2a_neonatal_epilepsy')!
    expect(c.qualifiers.map((q) => q.id)).toContain('scn2a_single_gof_assignment_refuted')
  })

  it('builds a route where every step cites its edge', () => {
    const r = atlas.route('dis_scn8a', 'dis_scn2a_neonatal_epilepsy')!
    expect(r.kind).toBe('mechanism')
    expect(r.via.id).toBe('mech_sodium_channel_gof')
    expect(r.steps.map((s) => s.edge.id)).toEqual(['scn8a_dee_gof', 'scn2a_neonatal_gof'])
    expect(r.communitySteps.map((s) => s.edge.relation)).toEqual(['subgroup_of', 'group_disease', 'asset_disease'])
    for (const s of [...r.steps, ...r.communitySteps]) expect(s.edge.evidence.length).toBeGreaterThan(0)
    expect(r.openQuestions.length).toBeGreaterThan(1)
  })

  it('produces an action plan with an asset, a partner and a concrete next step', () => {
    const p = atlas.actionPlan('dis_scn8a')
    expect(p.viable.map((c) => c.disease.id)).toEqual(['dis_scn2a_neonatal_epilepsy'])
    expect(p.assets.map((a) => a.node.id)).toContain('asset_scn2a_dragonfly')
    expect(p.partners.find((x) => x.sharedAcrossClusters)?.node.name).toBe('Ingo Helbig')
    expect(p.doThisWeek[0]!.title).toBe('Write to FamilieSCN2A Foundation')
    expect(p.unsupported.map((c) => c.disease.id)).toContain('dis_scn2a')
    expect(p.noRoute).toBeNull()
  })

  it('flags duplicate funded modelling of the same mechanism', () => {
    const p = atlas.actionPlan('dis_scn8a')
    expect(p.duplicates.some((d) => d.category === 'funded_research' && d.clusterId === 'c_sodium_gof')).toBe(true)
  })

  it('says "no supported route" for KCNQ2 and explains what is missing', () => {
    const p = atlas.actionPlan('dis_kcnq2')
    expect(p.viable).toHaveLength(0)
    expect(p.noRoute?.reason).toBe('only_broad_phenotypes')
    expect(p.noRoute?.missing[0]).toMatch(/No other condition/)
    expect(p.ownCommunities.map((c) => c.group.id)).toEqual(['group_kcnq2_cure'])
  })
})

describe('mechanism ranking (Biotech Scout)', () => {
  const atlas = make()

  it('ranks loss-of-function clusters with stated criteria', () => {
    const r = atlas.rankClusters({ effects: ['loss_of_function'] })
    expect(r.map((x) => x.cluster.id).sort()).toEqual(['c_kcnq2_channel', 'c_scn2a_lof', 'c_stxbp1_synaptic'])
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3])
  })

  it('finds the sodium gain-of-function cluster with two diseases and its contradiction', () => {
    const [top] = atlas.rankClusters({ effects: ['gain_of_function'] })
    expect(top!.cluster.id).toBe('c_sodium_gof')
    expect(top!.diseases.map((d) => d.id).sort()).toEqual(['dis_scn2a_neonatal_epilepsy', 'dis_scn8a'])
    expect(top!.qualifiers.map((q) => q.id)).toEqual(['scn2a_single_gof_assignment_refuted'])
  })
})

describe('admin review', () => {
  it('removes a rejected inferred link from connections', () => {
    const id = make().g.edges.find((e) => e.relation === 'shares_mechanism_with')!.id
    const atlas = make({ [id]: 'rejected' })
    expect(atlas.connections('dis_scn8a').find((c) => c.disease.id === 'dis_scn2a_neonatal_epilepsy')).toBeUndefined()
  })

  it('queues inferred and sample contributed edges', () => {
    const q = make().reviewQueue()
    expect(q.some((i) => i.origin === 'contributed' && i.edge.sample)).toBe(true)
    expect(q.filter((i) => i.origin === 'inferred').length).toBe(4)
  })

  it('reports that no edge is scored yet rather than inventing confidence', () => {
    expect(make().coverage().scoredEdges).toBe(0)
  })
})
