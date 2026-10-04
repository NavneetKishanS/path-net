'use client'

import type { ChatAnswer } from '@/lib/chat/answer'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { CitationMarker } from '@/components/evidence/citation'
import { BasisBadge, ContradictsBadge } from '@/components/evidence/badges'
import { ExternalLink } from '@/components/action/action-parts'
import type { Edge } from '@/lib/model'

function Citations({ edges }: { edges: Edge[] }) {
  if (!edges.length) return null
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
      {edges.map((e) => (
        <CitationMarker key={e.id} edge={e} />
      ))}
    </span>
  )
}

export function ChatAnswerView({ answer }: { answer: ChatAnswer }) {
  const { can } = useRole()
  const links = answer.links.filter((l) => can(l.panel))
  return (
    <div className="space-y-3 text-ui text-ink" data-testid="chat-answer">
      {answer.context && <p className="text-label text-ink-3">{answer.context}</p>}
      <p>
        {answer.lead}
        <Citations edges={answer.leadEdges} />
      </p>

      {answer.items.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {answer.items.map((item, i) => (
            <li key={i} className="py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {item.href ? (
                  <AppLink href={item.href} className="link font-medium">
                    {item.title}
                  </AppLink>
                ) : (
                  <span className="font-medium">{item.title}</span>
                )}
                {item.tone === 'inferred' && <BasisBadge basis="inferred" />}
                {item.tone === 'contradicts' && <ContradictsBadge />}
              </div>
              {item.detail && <p className="mt-1 text-label text-ink-2">{item.detail}</p>}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
                <Citations edges={item.edges} />
                {item.url && <ExternalLink href={item.url}>Source</ExternalLink>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {answer.caveats.length > 0 && (
        <div className="text-label text-ink-2">
          <p className="meta-label">Limits</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {answer.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {links.length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-label">
          {links.map((l) => (
            <AppLink key={l.href} href={l.href} className="link">
              {l.label}
            </AppLink>
          ))}
        </p>
      )}
    </div>
  )
}
