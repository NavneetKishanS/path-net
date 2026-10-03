'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient } from '@/api'
import type { SearchOptions } from './api/client'
import type { MechanismEffect } from './model'

const api = () => getApiClient()

// The dataset is a snapshot: keep results for the session; admin mutations invalidate everything.
const opts = { staleTime: Infinity } as const

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api().meta(), ...opts })
export const useSearch = (q: string, o?: SearchOptions) =>
  useQuery({ queryKey: ['search', q, o], queryFn: () => api().search(q, o), enabled: q.trim().length > 0, ...opts })
export const useGraph = () => useQuery({ queryKey: ['graph'], queryFn: () => api().getGraph(), ...opts })
export const useNode = (id: string | null) =>
  useQuery({ queryKey: ['node', id], queryFn: () => api().getNode(id!), enabled: !!id, ...opts })
export const useDiseases = () => useQuery({ queryKey: ['diseases'], queryFn: () => api().getDiseases(), ...opts })
export const useConnections = (id: string | null) =>
  useQuery({ queryKey: ['connections', id], queryFn: () => api().getConnections(id!), enabled: !!id, ...opts })
export const useRoute = (from: string | null, to: string | null) =>
  useQuery({
    queryKey: ['route', from, to],
    queryFn: () => api().getRoute(from!, to!),
    enabled: !!from && !!to,
    ...opts,
  })
export const useActionPlan = (id: string | null) =>
  useQuery({ queryKey: ['action', id], queryFn: () => api().getActionPlan(id!), enabled: !!id, ...opts })
export const useMechanisms = () => useQuery({ queryKey: ['mechanisms'], queryFn: () => api().getMechanisms(), ...opts })
export const useRankedClusters = (o: { effects?: MechanismEffect[]; mechanismId?: string } | null) =>
  useQuery({ queryKey: ['ranked', o], queryFn: () => api().rankClusters(o!), enabled: !!o, ...opts })
export const useAssets = () => useQuery({ queryKey: ['assets'], queryFn: () => api().getAssets(), ...opts })
export const usePeople = () => useQuery({ queryKey: ['people'], queryFn: () => api().getPeople(), ...opts })
export const useFunding = () => useQuery({ queryKey: ['funding'], queryFn: () => api().getFunding(), ...opts })
export const useCoverage = () => useQuery({ queryKey: ['coverage'], queryFn: () => api().getCoverage(), ...opts })
export const useReviewQueue = () => useQuery({ queryKey: ['review'], queryFn: () => api().getReviewQueue(), ...opts })
export const useAddedSynonyms = () =>
  useQuery({ queryKey: ['synonyms'], queryFn: () => api().getAddedSynonyms(), ...opts })

/** Id lookups over the cached graph, for components that only hold edge or node ids. */
export function useGraphIndex() {
  const graph = useGraph()
  return useMemo(() => {
    const edges = new Map((graph.data?.edges ?? []).map((e) => [e.id, e]))
    const nodes = new Map((graph.data?.nodes ?? []).map((n) => [n.id, n]))
    return { edges, nodes, ready: !!graph.data }
  }, [graph.data])
}

/** Look up an edge (with its evidence) by id from the cached graph. */
export function useEdge(id: string | null) {
  const graph = useGraph()
  const edge = id ? graph.data?.edges.find((e) => e.id === id) : undefined
  const nodes = graph.data?.nodes
  return {
    edge,
    from: edge ? nodes?.find((n) => n.id === edge.from) : undefined,
    to: edge ? nodes?.find((n) => n.id === edge.to) : undefined,
    isLoading: graph.isLoading,
  }
}

export function useAdminMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries()
  return {
    review: useMutation({
      mutationFn: (v: { edgeId: string; decision: 'approved' | 'rejected' | null }) =>
        api().reviewEdge(v.edgeId, v.decision),
      onSuccess: done,
    }),
    addSynonym: useMutation({
      mutationFn: (v: { nodeId: string; synonym: string }) => api().addSynonym(v.nodeId, v.synonym),
      onSuccess: done,
    }),
    removeSynonym: useMutation({
      mutationFn: (v: { nodeId: string; synonym: string }) => api().removeSynonym(v.nodeId, v.synonym),
      onSuccess: done,
    }),
  }
}
