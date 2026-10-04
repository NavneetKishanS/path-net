import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AtlasNode, Edge } from './model'
import { plainEdgeSentence, plainEvidence, plainNodeLabel, plainTerm } from './plain-language'
import { EvidencePanel } from '@/components/evidence/evidence-panel'

const presentation = vi.hoisted(() => ({ detail: 'plain' }))
vi.mock('@/components/role/role-provider', () => ({ useRole: () => ({ detail: presentation.detail }) }))
vi.mock('@/lib/queries', () => ({ useGraph: () => ({ data: { nodes: [], edges: [] } }) }))
vi.mock('@/components/evidence/citation', () => ({ CitationMarker: () => null }))

const node = (name: string, type: AtlasNode['type'], props: AtlasNode['props'] = {}): AtlasNode => ({
  id: name,
  name,
  type,
  props,
  synonyms: [],
  relatedTerms: [],
  ids: [],
  summary: null,
  clusters: [],
  centrality: 0,
})
const condition = node('Test condition', 'disease')
const mechanism = node('Test gain of function', 'mechanism', { effect: 'gain_of_function' })
const edge = (override: Partial<Edge> = {}): Edge => ({
  id: 'test-edge',
  from: condition.id,
  to: mechanism.id,
  relation: 'disease_mechanism',
  confidence: null,
  basis: 'observed',
  tier: 'B',
  status: 'verified',
  stance: 'supports',
  scope: 'Only three variants were tested in a mouse model; not a claim about all patients.',
  evidence: [
    {
      id: 'source-1',
      sourceType: 'PubMed',
      title: 'First original paper',
      url: 'https://example.test/source-1',
      date: '2026-10-03',
      stance: 'supports',
      snippet: 'Original unmodified quote one.',
    },
    {
      id: 'source-2',
      sourceType: 'PubMed',
      title: 'Second original paper',
      url: 'https://example.test/source-2',
      date: '2026-10-03',
      stance: 'contradicts',
      snippet: 'Original unmodified quote two.',
    },
  ],
  ...override,
})

describe('plain-language presentation', () => {
  it('explains a term without changing its scientific name or node', () => {
    const original = node('Hypotonia', 'phenotype')
    expect(plainNodeLabel(original)).toBe('Low muscle tone')
    expect(plainTerm(original)?.readingUrl).toBe('https://medlineplus.gov/ency/article/003298.htm')
    expect(original.name).toBe('Hypotonia')
  })

  it('keeps unfamiliar terms rather than guessing a medical translation', () => {
    const original = node('New unreviewed phenotype', 'phenotype')
    expect(plainTerm(original)).toBeNull()
    expect(plainNodeLabel(original)).toBe(original.name)
    expect(plainTerm(node('Unclassified process', 'mechanism'))).toBeNull()
  })

  it('does not turn a disease-level symptom into a claim about every patient', () => {
    const symptom = node('Inability to walk', 'phenotype')
    const sentence = plainEdgeSentence(edge({ relation: 'disease_phenotype' }), condition, symptom)
    expect(sentence).toContain('Unable to walk')
    expect(sentence).toContain('does not mean every person')
  })

  it('keeps contradictory and inferred findings visibly qualified', () => {
    expect(plainEdgeSentence(edge({ stance: 'contradicts' }), condition, mechanism)).toContain('argues against')
    expect(
      plainEdgeSentence(edge({ basis: 'inferred', relation: 'shares_mechanism_with' }), condition, mechanism),
    ).toContain('not a proven fact')
    expect(
      plainEdgeSentence(edge({ basis: 'inferred', relation: 'shares_investigator' }), condition, mechanism),
    ).toContain('inferred by the atlas')
  })

  it('preserves every citation, exact source quote, scope and an uncalibrated score', () => {
    const original = edge()
    const before = JSON.stringify(original)
    const readable = plainEvidence(original, condition, mechanism)
    expect(readable.evidence).toBe(original.evidence)
    expect(readable.scope).toBe(original.scope)
    expect(readable.confidence).toBeNull()
    expect(readable.evidence.map((e) => e.snippet)).toEqual(original.evidence.map((e) => e.snippet))
    expect(JSON.stringify(original)).toBe(before)
  })

  it('does not present a listed trial as an enrollment recommendation', () => {
    const study = node('Test study', 'study')
    expect(plainEdgeSentence(edge({ relation: 'study_disease' }), study, condition)).toContain(
      'does not mean someone is eligible',
    )
    expect(plainTerm(study)?.explanation).toContain('does not prove a treatment works')
  })

  it('labels pending and sample records explicitly', () => {
    const readable = plainEvidence(edge({ status: 'pending', sample: true }), condition, mechanism)
    expect(readable.warnings).toContain('This link has not completed review.')
    expect(readable.warnings.join(' ')).toContain('not a real research finding')
  })

  it('renders every original source and scope in simple language with quotations still accessible', () => {
    presentation.detail = 'plain'
    const original = edge()
    const html = renderToStaticMarkup(createElement(EvidencePanel, { edge: original, from: condition, to: mechanism }))
    expect(html).toContain('data-testid="plain-evidence"')
    expect(html).toContain('https://example.test/source-1')
    expect(html).toContain('https://example.test/source-2')
    expect(html).toContain(original.scope!)
    expect(html).toContain('Original unmodified quote one.')
    expect(html).toContain('Original unmodified quote two.')
    expect(html).toContain('This source limits or argues against the link.')
    expect(html).toContain('data-testid="original-evidence"')
    expect(html).toContain('Not scored yet.')
  })

  it('retains scientific wording and scores in technical view', () => {
    presentation.detail = 'technical'
    const html = renderToStaticMarkup(
      createElement(EvidencePanel, { edge: edge({ confidence: 0.62 }), from: condition, to: mechanism }),
    )
    expect(html).not.toContain('data-testid="plain-evidence"')
    expect(html).toContain('0.62')
    expect(html).toContain('Original unmodified quote one.')
    presentation.detail = 'plain'
  })
})
