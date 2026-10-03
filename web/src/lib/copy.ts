// Wording for each detail level. Plain copy is written for a parent reading at 2 a.m.:
// short sentences, no jargon, no scores. It explains categories, never invents claims.
import type { AtlasNode, Edge, MechanismEffect, NodeType, Relation, SourceType } from './model'

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  disease: 'Condition',
  gene: 'Gene',
  variant: 'Variant',
  mechanism: 'Mechanism',
  phenotype: 'Symptom',
  patientGroup: 'Patient group',
  paper: 'Paper',
  study: 'Study',
  asset: 'Shared asset',
  investigator: 'Investigator',
  funding: 'Funded project',
}

export const RELATION_LABEL: Record<Relation, string> = {
  disease_gene: 'caused by variants in',
  variant_of: 'is a variant in',
  gene_variant_mechanism: 'variant has mechanism',
  disease_mechanism: 'has mechanism',
  disease_phenotype: 'has symptom',
  group_disease: 'patient group for',
  asset_disease: 'resource for',
  study_disease: 'registered study for',
  investigator_disease: 'investigator on',
  investigator_award: 'principal investigator of',
  subgroup_of: 'subgroup of',
  shares_mechanism_with: 'shares a mechanism with',
  shares_investigator: 'shares an investigator with',
  contributed: 'contributed link to',
}

export const SOURCE_LABEL: Record<SourceType, string> = {
  PubMed: 'PubMed',
  OMIM: 'OMIM',
  ClinVar: 'ClinVar',
  HPO: 'HPO',
  ClinicalTrials: 'ClinicalTrials.gov',
  RePORTER: 'NIH RePORTER',
  NORD: 'NORD',
  Orphanet: 'Orphanet',
  MONDO: 'MONDO',
  PatientOrg: 'Patient organization',
  other: 'Other source',
}

/** What kind of source this is, in plain words. */
export const SOURCE_PLAIN: Record<SourceType, string> = {
  PubMed: 'a published research paper',
  OMIM: 'a genetics reference database',
  ClinVar: 'a public database of DNA changes',
  HPO: 'a medical list of symptoms for each condition',
  ClinicalTrials: 'the official register of clinical studies',
  RePORTER: 'the US government list of funded research',
  NORD: 'a rare disease directory',
  Orphanet: 'a rare disease reference',
  MONDO: 'a medical dictionary of conditions',
  PatientOrg: 'the patient organization’s own website',
  other: 'a source',
}

export const TIER_LABEL: Record<Edge['tier'], string> = {
  A: 'Curated database',
  B: 'Extracted from a source, quote checked',
  C: 'Inferred by the graph',
  D: 'Contributed by a user, pending review',
}

export const EFFECT_LABEL: Record<MechanismEffect, string> = {
  loss_of_function: 'Loss of function',
  gain_of_function: 'Gain of function',
  dominant_negative: 'Dominant negative',
  unknown: 'Mechanism unknown',
}

/** Plain glossary by mechanism class. General definitions, not claims about any disease. */
export const EFFECT_PLAIN: Record<MechanismEffect, string> = {
  loss_of_function:
    'the gene change means the body makes too little of a working protein, or the protein does less than it should',
  gain_of_function: 'the gene change makes a protein too active, or gives it a harmful new action',
  dominant_negative: 'the changed protein gets in the way of the healthy copy',
  unknown: 'how the gene change causes the condition is not yet known',
}

export function effectOf(node: AtlasNode | undefined): MechanismEffect {
  const e = node?.props.effect
  return e === 'loss_of_function' || e === 'gain_of_function' || e === 'dominant_negative' ? e : 'unknown'
}

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** One sentence describing an edge at plain or standard level. */
export function edgeSentence(edge: Edge, from: AtlasNode, to: AtlasNode, plain: boolean): string {
  switch (edge.relation) {
    case 'disease_mechanism':
      if (edge.stance === 'contradicts')
        return plain
          ? `Research shows not everyone with ${from.name} has the same kind of change, so they should not all be grouped as “${lc(to.name)}”.`
          : `Evidence contradicts assigning ${lc(to.name)} to all of ${from.name}.`
      return plain
        ? `Research found that in ${from.name}, ${EFFECT_PLAIN[effectOf(to)]}.`
        : `${from.name} has cited evidence for ${lc(to.name)}.`
    case 'gene_variant_mechanism':
      return plain
        ? `Lab tests of this DNA change found that ${EFFECT_PLAIN[effectOf(to)]}.`
        : `Variant ${from.name} showed ${lc(to.name)} in a functional assay.`
    case 'disease_gene':
      return plain
        ? `${from.name} is caused by changes in the ${to.name} gene.`
        : `${from.name} is caused by variants in ${to.name}.`
    case 'variant_of':
      return `${from.name} is a recorded change in ${to.name}.`
    case 'disease_phenotype':
      return plain ? `${to.name} is listed as a feature of ${from.name}.` : `HPO lists ${lc(to.name)} for ${from.name}.`
    case 'group_disease':
      return plain ? `${from.name} supports families affected by ${to.name}.` : `${from.name} serves ${to.name}.`
    case 'asset_disease':
      return plain
        ? `${from.name} collects information about ${to.name}.`
        : `${from.name} is a resource for ${to.name}.`
    case 'study_disease':
      return `${from.name} is a registered study for ${to.name}.`
    case 'investigator_disease':
      return plain
        ? `${from.name} leads government-funded research on ${to.name}.`
        : `${from.name} is listed on an NIH award for ${to.name}.`
    case 'investigator_award':
      return `${from.name} is principal investigator of “${to.name}”.`
    case 'subgroup_of':
      return plain
        ? `${from.name} is one group within ${to.name}.`
        : `${from.name} is a defined subgroup of ${to.name}.`
    case 'shares_mechanism_with':
      return plain
        ? `${from.name} and ${to.name} may share the same kind of underlying problem. This is a lead to check, not a proven fact.`
        : `Inferred: ${from.name} and ${to.name} share a mechanism.`
    case 'shares_investigator':
      return plain
        ? `The same researcher works on both ${from.name} and ${to.name}.`
        : `Inferred: ${from.name} and ${to.name} share an investigator.`
    case 'contributed':
      return `A user suggested a link between ${from.name} and ${to.name}. Not yet reviewed.`
  }
}

export function studyStatusText(status: string | null): string {
  if (!status) return 'Status not recorded'
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')
}

/** Studies that must not be presented as something to join. */
export function isOpenStudy(status: string | null): boolean {
  return status === 'RECRUITING' || status === 'NOT_YET_RECRUITING' || status === 'ENROLLING_BY_INVITATION'
}

export function formatDate(iso: string): string {
  if (!iso) return 'date not recorded'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatMoney(n: number | null): string {
  if (n === null) return 'not recorded'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
