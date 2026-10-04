import { describe, expect, it } from 'vitest'
import { createMockClient } from '@/lib/api/mock'
import { memoryOverrideStore } from '@/lib/api/atlas-client'
import { answerQuestion, classify, type ChatAnswer, type ChatContext } from './answer'
import { findEntities } from './entities'
import { suggestedQuestions } from './suggestions'

const api = createMockClient(memoryOverrideStore())
const ctx: ChatContext = { focusId: null, lastSubjectId: null, detail: 'standard' }
const ask = (q: string, c: Partial<ChatContext> = {}) => answerQuestion(api, q, { ...ctx, ...c })

/** Evidence integrity: nothing is listed without a cited edge behind it. */
function expectCited(a: ChatAnswer) {
  for (const item of a.items) expect(item.edges.length, item.title).toBeGreaterThan(0)
}

describe('chat intent', () => {
  it('routes the suggested questions to the right answer', () => {
    expect(classify('Which communities share a mechanism with DEE13?')).toBe('connections')
    expect(classify('What should we do this week about DEE13?')).toBe('action')
    expect(classify('Who is researching DEE13?')).toBe('people')
    expect(classify('Who else works on sodium channel gain of function?')).toBe('people')
    expect(classify('Which findings contradict a shared mechanism?')).toBe('contradictions')
    expect(classify('Which NIH awards fund STXBP1 research?')).toBe('funding')
    expect(classify('Why is DEE13 connected to SCN2A neonatal-onset epilepsy?')).toBe('route')
  })
})

describe('chat entities', () => {
  it('prefers the longest name, so a condition is not also read as its gene', async () => {
    const graph = await api.getGraph()
    const f = findEntities('Tell me about SCN2A-related neonatal-onset epilepsy subgroup', graph)
    expect(f.diseases.map((d) => d.id)).toEqual(['dis_scn2a_neonatal_epilepsy'])
    expect(f.genes).toEqual([])
  })

  it('matches a paraphrased mechanism class and flags gene-like terms outside the atlas', async () => {
    const graph = await api.getGraph()
    expect(findEntities('sodium channel gain of function', graph).mechanisms.length).toBeGreaterThan(0)
    expect(findEntities('What about CDKL5?', graph).unknown).toEqual(['CDKL5'])
  })
})

describe('chat answers', () => {
  it('lists cited mechanism connections for DEE13', async () => {
    const a = await ask('Which communities share a mechanism with DEE13?')
    expect(a.intent).toBe('connections')
    expect(a.subjectId).toBe('dis_scn8a')
    expect(a.items.some((i) => i.title.includes('SCN2A-related neonatal-onset epilepsy'))).toBe(true)
    expect(a.items.find((i) => i.tone === 'inferred')?.href).toMatch(/^\/route\?from=dis_scn8a&to=/)
    expectCited(a)
  })

  it('gives this week’s steps with their evidence', async () => {
    const a = await ask('What should we do this week about DEE13?')
    expect(a.items.length).toBeGreaterThan(0)
    expect(a.links.some((l) => l.href === '/action/dis_scn8a')).toBe(true)
    expectCited(a)
  })

  it('finds investigators for a mechanism through the conditions that carry it', async () => {
    const a = await ask('Who else works on sodium channel gain of function?', { detail: 'technical' })
    expect(a.intent).toBe('people')
    expect(a.leadEdges.length).toBeGreaterThan(0)
    expect(a.items.length).toBeGreaterThan(0)
    expectCited(a)
  })

  it('lists contradicting evidence, including PMID 37578743', async () => {
    const a = await ask('Which findings contradict a shared mechanism?')
    expect(a.items.every((i) => i.tone === 'contradicts')).toBe(true)
    expect(a.items.flatMap((i) => i.edges).some((e) => e.evidence.some((ev) => ev.pmid === '37578743'))).toBe(true)
    expectCited(a)
  })

  it('answers funding questions from award records', async () => {
    const a = await ask('Which NIH awards fund STXBP1 research?')
    expect(a.intent).toBe('funding')
    expectCited(a)
  })

  it('explains a route step by step', async () => {
    const a = await ask('Why is DEE13 connected to SCN2A neonatal-onset epilepsy?')
    expect(a.intent).toBe('route')
    expect(a.items.length).toBeGreaterThan(1)
    expectCited(a)
  })

  it('uses the previous subject for follow-up questions', async () => {
    const a = await ask('Who is researching it?', { lastSubjectId: 'dis_stxbp1' })
    expect(a.subjectId).toBe('dis_stxbp1')
    expect(a.context).toMatch(/^About /)
  })

  it('says so when a term is outside the atlas, instead of guessing', async () => {
    const a = await ask('Which groups work on CDKL5?')
    expect(a.intent).toBe('not_in_atlas')
    expect(a.items).toEqual([])
    expect(a.lead).toContain('CDKL5')
  })

  it('asks for a subject when the question names none', async () => {
    const a = await ask('Who could help us?')
    expect(a.intent).toBe('unclear')
  })
})

describe('chat suggestions', () => {
  it('offers three questions per role, about the condition in focus', async () => {
    const graph = await api.getGraph()
    const leader = suggestedQuestions('leader', graph, 'dis_stxbp1')
    expect(leader).toHaveLength(3)
    expect(leader[0]).toMatch(/DEE4|STXBP1/)
    expect(suggestedQuestions('researcher', graph, null)).toHaveLength(3)
  })
})
