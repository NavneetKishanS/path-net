import type { EdgeRow, EvidenceRow, Graph, NodeRow, Role } from './types'
import { TIER_TEXT } from './types'

const nameOf = (g: Graph, id: string) => g.nodes.find((n) => n.id === id)?.name ?? id

export function Welcome({ role }: { role: Role }) {
  return (
    <div className="panel">
      <h2>Start with one search</h2>
      <p>Type a disease, gene, symptom, patient group or mechanism. Click a node to see how it connects, and click any line to see the evidence behind it.</p>
      <p className="muted">Viewing as <b>{role.replace('_', ' ')}</b>. Role-specific views are not built yet (v0).</p>
    </div>
  )
}

// Shown when a search finds nothing. P3/P4: replace the body with the real coverage report.
export function NoRoutePanel({ query }: { query: string }) {
  return (
    <div className="panel">
      <h2>No supported route</h2>
      <p>The atlas has nothing for <b>“{query}”</b>.</p>
      <p><b>Searched:</b> node names and synonyms in this slice.</p>
      <p><b>Missing:</b> any paper, trial, registry or patient group linked to this term.</p>
      <p><b>Next:</b> check the name against MONDO or Orphanet synonyms, then search PubMed and patient-group directories for it.</p>
    </div>
  )
}

export function NodePanel({ graph, node, onEdge }: { graph: Graph; node: NodeRow; onEdge: (id: string) => void }) {
  const edges = graph.edges.filter((e) => e.src === node.id || e.dst === node.id)
  const clusters = graph.node_cluster.filter((nc) => nc.node_id === node.id).map((nc) => graph.clusters.find((c) => c.id === nc.cluster_id)?.label)
  const plain = node.props.plain as string | undefined
  return (
    <div className="panel">
      <p className="eyebrow">{node.type.replace('_', ' ')}{node.props.placeholder ? ' · placeholder' : ''}</p>
      <h2>{node.name}</h2>
      {plain && <p>{plain}</p>}
      {node.synonyms.length > 0 && <p className="muted">Also known as: {node.synonyms.join(', ')}</p>}
      {clusters.length > 0 && <p><b>Cluster:</b> {clusters.join(' and ')}</p>}
      <h3>Connections</h3>
      <ul className="links">
        {edges.map((e) => (
          <li key={e.id}>
            <button onClick={() => onEdge(e.id)}>
              {nameOf(graph, e.src)} → {nameOf(graph, e.dst)}
            </button>
            <span className="muted"> {e.type.replace(/_/g, ' ')} · tier {e.tier}{e.stance === 'contradicts' ? ' · contradicts' : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EvidenceItem({ ev }: { ev: EvidenceRow }) {
  const isPlaceholder = ev.source_type === 'placeholder' || !ev.source_url
  return (
    <li className="evidence">
      {isPlaceholder ? (
        <p className="warn">Placeholder: no real source yet.</p>
      ) : (
        <p><a href={ev.source_url!} target="_blank" rel="noreferrer">{ev.source_url}</a>{ev.pmid ? ` (PMID ${ev.pmid})` : ''}</p>
      )}
      {ev.snippet && <blockquote>{ev.snippet}</blockquote>}
      {ev.retrieved_at && <p className="muted">Retrieved {ev.retrieved_at}</p>}
    </li>
  )
}

export function EdgePanel({ graph, edge }: { graph: Graph; edge: EdgeRow }) {
  const evidence = graph.evidence.filter((ev) => ev.edge_id === edge.id)
  return (
    <div className="panel">
      <p className="eyebrow">{edge.type.replace(/_/g, ' ')}</p>
      <h2>{nameOf(graph, edge.src)} → {nameOf(graph, edge.dst)}</h2>
      <p>
        <span className={`pill tier-${edge.tier}`}>Tier {edge.tier}</span>{' '}
        {edge.stance === 'contradicts' && <span className="pill bad">Contradicts</span>}{' '}
        <span className="pill muted-pill">{edge.status}</span>
      </p>
      <p>{TIER_TEXT[edge.tier]}.</p>
      {edge.confidence !== null && <p><b>Confidence:</b> {Math.round(edge.confidence * 100)}%</p>}
      {edge.note && <p>{edge.note}</p>}
      <h3>Evidence</h3>
      {evidence.length === 0 ? <p className="warn">No evidence rows yet for this edge.</p> : <ul className="plain">{evidence.map((ev) => <EvidenceItem key={ev.id} ev={ev} />)}</ul>}
    </div>
  )
}
