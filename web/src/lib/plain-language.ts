import type { AtlasNode, Edge, Relation } from './model'
import { EFFECT_PLAIN, edgeSentence, effectOf } from './copy'

/** Presentation only: never changes graph rows, evidence, scope or confidence. */
export interface PlainTerm {
  label: string
  explanation: string
  /** Optional general reading, distinct from evidence for a disease relationship. */
  readingUrl?: string
}

const MOVEMENT_READING = 'https://medlineplus.gov/movementdisorders.html'

// Small, curated vocabulary. Terms without a reviewed explanation keep their original name.
// General definitions are not new disease annotations and must not be used for diagnosis.
const SYMPTOMS: Record<string, PlainTerm> = {
  hypotonia: {
    label: 'Low muscle tone',
    explanation: 'Muscles have less resting tension than usual.',
    readingUrl: 'https://medlineplus.gov/ency/article/003298.htm',
  },
  ataxia: {
    label: 'Difficulty coordinating movements',
    explanation: 'Movements are less coordinated, which can affect balance and walking.',
    readingUrl: MOVEMENT_READING,
  },
  dystonia: {
    label: 'Uncontrolled muscle tightening',
    explanation: 'Muscles tighten without the person choosing to, causing twisting or repeated movements.',
    readingUrl: 'https://medlineplus.gov/dystonia.html',
  },
  tremor: {
    label: 'Shaking movements',
    explanation: 'Repeated shaking that the person does not choose to make.',
    readingUrl: MOVEMENT_READING,
  },
  'intellectual disability': {
    label: 'Difficulties with learning and daily skills',
    explanation: 'A medical term for limitations in learning, reasoning and skills used in everyday life.',
    readingUrl: 'https://medlineplus.gov/ency/article/001523.htm',
  },
  'global developmental delay': {
    label: 'Delay in several areas of development',
    explanation: 'A child develops more slowly than expected in several areas, such as movement, language or learning.',
  },
  'developmental regression': {
    label: 'Loss of skills learned earlier',
    explanation: 'A person loses abilities they had already learned.',
  },
  'delayed speech and language development': {
    label: 'Speech and language develop later',
    explanation: 'Speaking or understanding language develops later than expected.',
  },
  'absent speech': { label: 'No spoken words', explanation: 'Spoken words are not present.' },
  'inability to walk': { label: 'Unable to walk', explanation: 'Walking is not possible.' },
  'feeding difficulties': {
    label: 'Difficulty feeding',
    explanation: 'There are difficulties with feeding or eating.',
  },
  pallor: { label: 'Unusually pale skin', explanation: 'The skin appears paler than usual.' },
  'facial erythema': { label: 'Redness of the face', explanation: 'The skin on the face is red.' },
}

const MECHANISM_LABEL = {
  loss_of_function: 'Reduced protein function',
  gain_of_function: 'Increased or changed protein activity',
  dominant_negative: 'Changed protein interferes with a working copy',
  unknown: 'Mechanism needs further explanation',
} as const

export const PLAIN_RELATION_LABEL: Record<Relation, string> = {
  disease_gene: 'Related gene',
  variant_of: 'DNA changes in this gene',
  gene_variant_mechanism: 'What laboratory tests found',
  disease_mechanism: 'How it may affect the body',
  disease_phenotype: 'Recorded symptoms and features',
  group_disease: 'Patient communities',
  asset_disease: 'Research resources',
  study_disease: 'Registered research studies',
  investigator_disease: 'People working on this condition',
  investigator_award: 'Research projects led by this person',
  subgroup_of: 'Related groups of conditions',
  shares_mechanism_with: 'Possible shared cause in the body',
  shares_investigator: 'Shared researchers',
  contributed: 'Suggested connections',
}

/** A short definition of a term, separate from a claim about a patient or disease. */
export function plainTerm(node: AtlasNode): PlainTerm | null {
  if (node.type === 'phenotype') return SYMPTOMS[node.name.trim().toLowerCase()] ?? null
  if (node.type === 'mechanism') {
    const effect = effectOf(node)
    // An unclassified effect is not evidence that the mechanism itself is unknown.
    if (effect === 'unknown') return null
    return {
      label: MECHANISM_LABEL[effect],
      explanation: `In general, this means ${EFFECT_PLAIN[effect]}. The cited research describes where this applies.`,
    }
  }
  if (node.type === 'gene')
    return {
      label: node.name,
      explanation: 'A gene is part of the body’s instructions. A change in a gene can affect how a protein works.',
      readingUrl: 'https://medlineplus.gov/genetics/understanding/mutationsanddisorders/mutationscausedisease/',
    }
  if (node.type === 'variant')
    return { label: node.name, explanation: 'A variant is a change in DNA. Its effects depend on the specific change.' }
  if (node.type === 'study')
    return {
      label: node.name,
      explanation:
        'A research study record describes planned or ongoing work. It does not prove a treatment works. The study team must check who can take part.',
    }
  if (node.type === 'asset') {
    const kind = String(node.props.asset_type ?? node.props.kind ?? '').toLowerCase()
    if (kind.includes('natural_history'))
      return { label: node.name, explanation: 'A natural history study follows how a condition changes over time.' }
    if (kind.includes('biorepository') || kind.includes('biosample'))
      return {
        label: node.name,
        explanation:
          'A collection of biological samples for research. Access and permission must be checked with its team.',
      }
    if (kind.includes('registry') || kind.includes('patient_data'))
      return {
        label: node.name,
        explanation: 'A registry collects information to help researchers understand a condition.',
      }
  }
  return null
}

export function plainNodeLabel(node: AtlasNode): string {
  return plainTerm(node)?.label ?? node.name
}

/** Keep scientific scope as written; do not run global word replacement over source text. */
export function plainEdgeSentence(edge: Edge, from: AtlasNode, to: AtlasNode): string {
  if (edge.stance === 'contradicts') {
    if (edge.relation === 'disease_mechanism')
      return `This evidence argues against assigning “${to.name}” to everyone with ${from.name}. Different DNA changes can have different effects.`
    return `This evidence limits or contradicts the proposed link between ${from.name} and ${to.name}.`
  }
  let sentence: string
  switch (edge.relation) {
    case 'disease_mechanism':
      sentence = `Cited research links ${from.name} with ${plainNodeLabel(to).toLowerCase()}. This does not mean it applies to every person or every DNA change.`
      break
    case 'gene_variant_mechanism':
      sentence = `Laboratory research links the DNA change ${from.name} with ${plainNodeLabel(to).toLowerCase()}. A laboratory result alone does not predict every person’s experience.`
      break
    case 'disease_phenotype':
      sentence = `${plainNodeLabel(to)} is recorded as a feature of ${from.name}. This does not mean every person has this feature.`
      break
    case 'asset_disease':
      sentence = `${from.name} is a research resource linked to ${to.name}. Check its purpose and access rules with its team.`
      break
    case 'study_disease':
      sentence = `${from.name} is a registered research study linked to ${to.name}. Being listed here does not mean someone is eligible to join.`
      break
    case 'investigator_disease':
      sentence = `${from.name} is linked to research on ${to.name}.`
      break
    default:
      sentence = edgeSentence(edge, from, to, true)
  }
  if (edge.basis === 'inferred' && edge.relation !== 'shares_mechanism_with' && edge.relation !== 'contributed')
    return `Possible connection inferred by the atlas: ${sentence} This needs checking against the original findings.`
  return sentence
}

export function plainEvidence(edge: Edge, from: AtlasNode, to: AtlasNode) {
  const warnings: string[] = []
  if (edge.basis === 'inferred')
    warnings.push('The atlas joined separate findings to suggest this link. It is a lead to check, not a proven fact.')
  if (edge.stance === 'contradicts') warnings.push('This source argues against or limits the link.')
  if (edge.status !== 'verified')
    warnings.push(
      edge.status === 'rejected' ? 'This link was rejected in review.' : 'This link has not completed review.',
    )
  if (edge.sample) warnings.push('This is a sample used for demonstration, not a real research finding.')
  return {
    sentence: plainEdgeSentence(edge, from, to),
    scientificSentence: edgeSentence(edge, from, to, false),
    warnings,
    // Keep these original fields intact, including null scores and source quotations.
    scope: edge.scope,
    evidence: edge.evidence,
    confidence: edge.confidence,
  }
}
