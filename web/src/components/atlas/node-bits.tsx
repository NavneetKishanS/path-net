'use client'

import type { AtlasNode, Cluster } from '@/lib/model'
import { EFFECT_PLAIN, NODE_TYPE_LABEL, effectOf } from '@/lib/copy'
import { cn } from '@/lib/cn'
import { SampleBadge } from '@/components/evidence/badges'

export const CLUSTER_VAR = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)'] as const

export function ClusterSwatch({ cluster, className }: { cluster: Cluster; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-[1px]', className)}
      style={{ background: CLUSTER_VAR[cluster.hue] }}
    />
  )
}

export function ClusterTag({ cluster }: { cluster: Cluster }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-label text-ink-2">
      <ClusterSwatch cluster={cluster} />
      {cluster.label}
    </span>
  )
}

/** Gene symbols, ontology ids and variant names are identifiers: set in mono. */
export function Ident({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[0.92em] tracking-tight', className)}>{children}</span>
}

export function ExternalIds({ node, limit = 6 }: { node: AtlasNode; limit?: number }) {
  if (node.ids.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Identifiers">
      {node.ids.slice(0, limit).map((id) => {
        const text = id.value.toUpperCase().startsWith(`${id.namespace.toUpperCase()}:`)
          ? id.value
          : `${id.namespace} ${id.value}`
        return (
          <li key={`${id.namespace}:${id.value}`} className="text-label text-ink-3">
            {id.url ? (
              <a href={id.url} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
                <Ident>{text}</Ident>
              </a>
            ) : (
              <Ident>{text}</Ident>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function TypeLabel({ node }: { node: AtlasNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-label text-ink-3">
      {NODE_TYPE_LABEL[node.type]}
      {node.sample && <SampleBadge />}
    </span>
  )
}

/** Plain description for a mechanism, built from its class. */
export function mechanismPlain(node: AtlasNode): string {
  const effect = effectOf(node)
  const text = EFFECT_PLAIN[effect]
  return text.charAt(0).toUpperCase() + text.slice(1) + '.'
}

export function displayName(node: AtlasNode, plain: boolean): string {
  if (!plain || node.type !== 'disease') return node.name
  const gene = typeof node.props.gene_symbol === 'string' ? node.props.gene_symbol : null
  return gene && !node.name.includes(gene) ? `${node.name} (${gene})` : node.name
}
