'use client'

import { useMemo, useRef, useState } from 'react'
import type { ActionPlan, Route } from '@/lib/model'
import { edgeSentence } from '@/lib/copy'
import { shortSource } from '@/components/evidence/citation'
import { Button } from '@/components/ui/button'

/** Builds the message from the cited route only. Every factual line carries its source. */
export function buildOutreach(plan: ActionPlan, route: Route): { to: string; subject: string; body: string } | null {
  const top = plan.viable[0]
  const group = top?.communities[0]?.group
  if (!top || !group) return null
  const mech = route.via.name.toLowerCase()
  const cite = (i: number) => {
    const s = route.steps[i]
    const ev = s?.edge.evidence[0]
    return s && ev
      ? `${edgeSentence(s.edge, s.subject, s.object, false)} [${shortSource(ev)}${ev.url ? `, ${ev.url}` : ''}]`
      : null
  }
  const findings = route.steps.map((_, i) => cite(i)).filter((x): x is string => !!x)
  const limits = route.qualifiers
    .map((q) => {
      const ev = q.evidence[0]
      return ev ? `${q.scope ?? 'A study reports evidence that limits this link.'} [${shortSource(ev)}]` : null
    })
    .filter((x): x is string => !!x)
  const registry = plan.assets.find(
    (a) => a.category === 'patient_data' && a.diseases.some((d) => d.id !== plan.disease.id),
  )
  const questions = route.openQuestions.slice(0, 2)

  const body = [
    `Dear ${group.name} team,`,
    '',
    `I work with families affected by ${plan.disease.name}. While mapping research on our condition, we found published evidence that it may share a mechanism (${mech}) with ${top.disease.name}:`,
    '',
    ...findings.map((f, i) => `${i + 1}. ${f}`),
    '',
    `Putting these two findings together is our own inference, not a published conclusion.${limits.length ? ` We also note a limit: ${limits.join(' ')}` : ''}`,
    '',
    'Would you be open to a short call to discuss:',
    ...questions.map((q) => `- ${q}`),
    ...(registry ? [`- How ${registry.node.name} was set up, and whether its design could inform ours.`] : []),
    '',
    'Kind regards,',
    '[Your name]',
    '[Your organization]',
  ].join('\n')

  return { to: group.name, subject: `${plan.disease.name} and ${top.disease.name}: a shared mechanism?`, body }
}

export function DraftOutreach({ plan, route }: { plan: ActionPlan; route: Route }) {
  const draft = useMemo(() => buildOutreach(plan, route), [plan, route])
  const area = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)
  if (!draft) return null
  const copy = async () => {
    const text = `Subject: ${draft.subject}\n\n${area.current?.value ?? draft.body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      area.current?.select()
    }
  }
  return (
    <div data-testid="draft-outreach">
      <p className="mb-3 border-l-2 border-inferred pl-3 text-label text-ink-2">
        Draft. Check every claim against its source before sending, and add what you know about your own community.
      </p>
      <dl className="mb-2 grid grid-cols-[64px_1fr] gap-y-1 text-label">
        <dt className="text-ink-3">To</dt>
        <dd className="text-ink">{draft.to} (use their public contact route)</dd>
        <dt className="text-ink-3">Subject</dt>
        <dd className="text-ink">{draft.subject}</dd>
      </dl>
      <label htmlFor="draft-body" className="sr-only">
        Message draft
      </label>
      <textarea
        id="draft-body"
        ref={area}
        defaultValue={draft.body}
        rows={16}
        className="w-full resize-y rounded-sm border border-line bg-surface p-3 font-mono text-[12.5px] leading-relaxed text-ink focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={copy}>
          Copy message
        </Button>
        <span role="status" aria-live="polite" className="text-label text-ink-3">
          {copied ? 'Copied to clipboard' : ''}
        </span>
      </div>
    </div>
  )
}
