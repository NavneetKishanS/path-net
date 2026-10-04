'use client'

import type { ActionPlan } from '@/lib/model'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Pending } from '@/components/layout/page'
import { DoThisWeek, ExternalLink, StudyList } from '@/components/action/action-parts'
import { BasisBadge } from '@/components/evidence/badges'
import { useActionPlan, useCoverage, useGraph, useNode, useRoute } from '@/lib/queries'
import { isOpenStudy } from '@/lib/copy'
import { plainEdgeSentence, plainNodeLabel, plainTerm } from '@/lib/plain-language'
import { CitationMarker } from '@/components/evidence/citation'
import { NoRouteState } from './no-route'
import { displayName } from './node-bits'

/**
 * Patient / Caregiver view of a condition: your community if there is one, otherwise the closest
 * related communities with a plain reason, otherwise an honest "not yet" and how to help build one.
 */
export function CommunityFinder({ diseaseId }: { diseaseId: string }) {
  const plan = useActionPlan(diseaseId)
  const coverage = useCoverage()
  if (plan.isLoading || coverage.isLoading) return <Pending label="Looking for your community" lines={6} />
  if (plan.error || !plan.data) return <ErrorNote error={plan.error ?? 'Condition not found'} />
  return <Finder p={plan.data} />
}

function Finder({ p }: { p: ActionPlan }) {
  const coverage = useCoverage()
  const nodeQuery = useNode(p.disease.id)
  const neighbours = new Map((nodeQuery.data?.neighbours ?? []).map((n) => [n.id, n]))
  const symptoms = (nodeQuery.data?.edges ?? []).filter(
    (e) => e.relation === 'disease_phenotype' && e.from === p.disease.id,
  )
  const direct = p.ownCommunities.filter((c) => !c.viaParent)
  const viaParent = p.ownCommunities.filter((c) => c.viaParent)
  const registries = p.assets.filter(
    (a) =>
      a.category === 'patient_data' &&
      a.diseases.some((d) => d.id === p.disease.id || p.ownCommunities.some((c) => c.viaParent?.id === d.id)),
  )
  const openStudies = p.studies.filter((s) => isOpenStudy(s.status) && s.diseases.some((d) => d.id === p.disease.id))
  const related = p.viable
  const name = displayName(p.disease, true)

  return (
    <div className="space-y-10">
      <header className="title-band -mt-8 pt-8 pb-8 md:-mt-10 md:pt-10">
        <p className="meta-label mb-1">Condition</p>
        <h1 className="text-h2 text-ink md:text-h1" data-testid="disease-title">
          {name}
        </h1>
        {p.disease.synonyms.length > 0 && (
          <p className="mt-2 text-ui text-ink-2">Also called {p.disease.synonyms.slice(0, 2).join(' or ')}.</p>
        )}
        {p.disease.summary && (
          <details className="mt-3 max-w-[68ch] text-ui">
            <summary className="cursor-pointer text-accent-ink">Original condition description</summary>
            <p className="mt-2 text-ink-2">{p.disease.summary}</p>
          </details>
        )}
      </header>

      <section aria-labelledby="yours" data-testid="your-community">
        <h2 id="yours" className="text-h3 text-ink">
          {direct.length > 0 ? 'Your community' : viaParent.length > 0 ? 'The closest community' : 'Your community'}
        </h2>
        {direct.length > 0 || viaParent.length > 0 ? (
          <ul className="mt-3 space-y-4">
            {[...direct, ...viaParent].map((c) => (
              <li key={c.group.id} className="border-l-2 border-supports pl-4">
                <p className="text-[20px] font-semibold text-ink">{c.group.name}</p>
                <p className="mt-0.5 text-ui text-ink-2">
                  {c.viaParent
                    ? `This group serves everyone with ${c.viaParent.name}, which includes ${p.disease.name}.`
                    : `A patient organization for ${p.disease.name}.`}{' '}
                  <CitationMarker edge={c.edge} />
                </p>
                {typeof c.group.props.next_step === 'string' && (
                  <p className="mt-1 text-ui text-ink-2">{c.group.props.next_step}</p>
                )}
                {typeof c.group.props.url === 'string' && (
                  <p className="mt-2 text-ui">
                    <ExternalLink href={c.group.props.url}>Visit {c.group.name}</ExternalLink>
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 max-w-[60ch] text-body text-ink-2">
            We could not find a patient group for this exact condition in the atlas.
          </p>
        )}
      </section>

      {registries.length > 0 && (
        <section aria-labelledby="registries">
          <h2 id="registries" className="text-h3 text-ink">
            Ways to take part in research
          </h2>
          <ul className="mt-3 space-y-3">
            {registries.map((r) => (
              <li key={r.node.id} className="text-ui">
                <p className="font-medium text-ink">{r.node.name}</p>
                <p className="text-ink-2">
                  A registry where families share information to help research. <CitationMarker edge={r.edge} />
                </p>
                {r.url && (
                  <p className="mt-1">
                    <ExternalLink href={r.url}>Read about it</ExternalLink>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" data-testid="related-communities">
          <h2 id="related" className="text-h3 text-ink">
            Related communities
          </h2>
          <p className="mt-1 text-ui text-ink-2">
            These conditions have a different name but research suggests a similar cause in the body.
          </p>
          <ul className="mt-3 space-y-4">
            {related.map((c) => (
              <RelatedRow key={c.disease.id} fromId={p.disease.id} c={c} />
            ))}
          </ul>
        </section>
      )}

      {related.length === 0 && p.noRoute && coverage.data && (
        <NoRouteState noRoute={p.noRoute} coverage={coverage.data} />
      )}

      {direct.length === 0 && (
        <section aria-labelledby="build">
          <h2 id="build" className="text-h3 text-ink">
            Help build the missing community
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ui text-ink-2 marker:text-ink-3">
            {viaParent.length > 0 && (
              <li>
                Ask {viaParent[0]!.group.name} whether they have, or would start, a group for {p.disease.name} families.
              </li>
            )}
            <li>
              Ask your care team whether they know other families with the same diagnosis who would like to connect.
            </li>
            <li>Tell the atlas team which group you belong to, so it can be checked and added with its source.</li>
          </ul>
        </section>
      )}

      {openStudies.length > 0 && (
        <section aria-labelledby="studies">
          <h2 id="studies" className="mb-3 text-h3 text-ink">
            Studies looking for people
          </h2>
          <StudyList studies={openStudies} />
          <p className="mt-2 text-label text-ink-3">
            Whether a study is right for you is a question for its team and your doctor.
          </p>
        </section>
      )}

      {p.doThisWeek.length > 0 && (
        <section aria-labelledby="next">
          <h2 id="next" className="mb-3 text-h3 text-ink">
            What you can do next
          </h2>
          <DoThisWeek items={p.doThisWeek.filter((a) => a.id !== 'compare-measures').slice(0, 2)} />
        </section>
      )}

      {symptoms.length > 0 && (
        <section aria-labelledby="recorded-features" data-testid="plain-symptoms">
          <h2 id="recorded-features" className="text-h3 text-ink">
            Understanding the recorded symptoms
          </h2>
          <p className="mt-1 max-w-[68ch] text-ui text-ink-2">
            These features are recorded for this condition. Every person is different; this list does not mean everyone
            has them.
          </p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {symptoms.map((e) => {
              const symptom = neighbours.get(e.to)
              if (!symptom) return null
              const term = plainTerm(symptom)
              return (
                <li key={e.id} className="py-2.5 text-ui">
                  <AppLink href={`/node/${symptom.id}`} className="link font-medium">
                    {plainNodeLabel(symptom)}
                  </AppLink>{' '}
                  <CitationMarker edge={e} />
                  {term && <p className="mt-0.5 text-ink-2">{term.explanation}</p>}
                  {term && term.label !== symptom.name && (
                    <p className="text-label text-ink-3">Medical term: {symptom.name}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function RelatedRow({ fromId, c }: { fromId: string; c: ActionPlan['viable'][number] }) {
  const route = useRoute(fromId, c.disease.id)
  const graph = useGraph()
  const r = route.data
  return (
    <li className="border-l-2 border-dashed border-inferred pl-4">
      <p className="text-[18px] font-semibold text-ink">{displayName(c.disease, true)}</p>
      {r?.inferredEdge && (
        <p className="mt-0.5 text-ui text-ink-2">{plainEdgeSentence(r.inferredEdge, r.from, r.to)}</p>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-2 text-label">
        <BasisBadge basis="inferred" />
        <span className="text-ink-3">A lead to check, not a proven link.</span>
      </p>
      {c.qualifiers.length > 0 && (
        <div className="mt-2 space-y-1 text-ui text-ink-2">
          <p className="font-medium">Evidence that limits this connection</p>
          {c.qualifiers.map((q) => {
            const a = graph.data?.nodes.find((n) => n.id === q.from)
            const b = graph.data?.nodes.find((n) => n.id === q.to)
            return (
              <p key={q.id}>
                {a && b ? plainEdgeSentence(q, a, b) : 'This evidence limits the connection.'}{' '}
                <CitationMarker edge={q} />
              </p>
            )
          })}
        </div>
      )}
      {c.communities.length > 0 && (
        <p className="mt-2 text-ui text-ink-2">
          Their community:{' '}
          {c.communities.map((k, i) => (
            <span key={k.group.id}>
              {i > 0 && ', '}
              {typeof k.group.props.url === 'string' ? (
                <ExternalLink href={k.group.props.url}>{k.group.name}</ExternalLink>
              ) : (
                k.group.name
              )}
            </span>
          ))}
        </p>
      )}
      <p className="mt-2 text-ui">
        <AppLink href={`/route?from=${fromId}&to=${c.disease.id}`} className="link">
          Why we think they are related
        </AppLink>
      </p>
    </li>
  )
}
