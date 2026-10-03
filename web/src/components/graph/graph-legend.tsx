import type { Cluster } from '@/lib/model'
import { ClusterSwatch } from '@/components/atlas/node-bits'

function Line({ dash, color, tee }: { dash?: string; color: string; tee?: boolean }) {
  return (
    <svg width="26" height="10" aria-hidden className="shrink-0">
      <line x1="1" y1="5" x2={tee ? 21 : 25} y2="5" stroke={color} strokeWidth="2" strokeDasharray={dash} />
      {tee && <line x1="22" y1="1" x2="22" y2="9" stroke={color} strokeWidth="2" />}
    </svg>
  )
}

function Shape({ kind }: { kind: 'circle' | 'diamond' | 'hexagon' | 'square' | 'triangle' | 'rounded' }) {
  const s = 'var(--neutral-node)'
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
      {kind === 'circle' && <circle cx="6" cy="6" r="5" fill={s} />}
      {kind === 'diamond' && <path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" fill={s} />}
      {kind === 'hexagon' && <path d="M3 1h6l3 5-3 5H3L0 6Z" fill={s} />}
      {kind === 'square' && <rect x="1" y="1" width="10" height="10" fill={s} />}
      {kind === 'rounded' && <rect x="1" y="2" width="10" height="8" rx="3" fill={s} />}
      {kind === 'triangle' && <path d="M6 1 11 11H1Z" fill={s} />}
    </svg>
  )
}

export function GraphLegend({ clusters, compact }: { clusters: Cluster[]; compact?: boolean }) {
  return (
    <div className="space-y-3 text-label text-ink-2" aria-label="Map legend">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        <li className="flex items-center gap-1.5">
          <Line color="var(--line-strong)" /> Cited link
        </li>
        <li className="flex items-center gap-1.5">
          <Line color="var(--inferred)" dash="5 4" /> Inferred
        </li>
        <li className="flex items-center gap-1.5">
          <Line color="var(--ink-3)" dash="9 4" /> Bridge between clusters
        </li>
        <li className="flex items-center gap-1.5">
          <Line color="var(--contra)" tee /> Contradicts
        </li>
      </ul>
      {!compact && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          <li className="flex items-center gap-1.5">
            <Shape kind="circle" /> Condition (size: number of cited links)
          </li>
          <li className="flex items-center gap-1.5">
            <Shape kind="diamond" /> Mechanism
          </li>
          <li className="flex items-center gap-1.5">
            <Shape kind="rounded" /> Gene or variant
          </li>
          <li className="flex items-center gap-1.5">
            <Shape kind="hexagon" /> Patient group
          </li>
          <li className="flex items-center gap-1.5">
            <Shape kind="square" /> Registry, study, sample or award
          </li>
          <li className="flex items-center gap-1.5">
            <Shape kind="triangle" /> Investigator
          </li>
        </ul>
      )}
      {clusters.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {clusters.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              <ClusterSwatch cluster={c} /> {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
