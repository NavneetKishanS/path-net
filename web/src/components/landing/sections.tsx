// Landing-page sections. Every claim here is sourced from the actual challenge brief or the
// real pipeline/stack -- nothing invented (no fake testimonials, ratings, pricing or clients).
import {
  Database,
  GitBranch,
  HeartHandshake,
  Microscope,
  Repeat,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/cn'

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-[640px] text-center">
      <p className="text-meta font-semibold tracking-wide text-accent-ink uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-h1 font-bold text-ink">{title}</h2>
      {lead && <p className="mt-3 text-ui text-ink-2">{lead}</p>}
    </div>
  )
}

const SOURCES = ['PubMed / PMC', 'ClinicalTrials.gov', 'NIH RePORTER', 'HPO', 'MONDO', 'ClinVar', 'Orphadata', 'Patient organizations']

export function SourcesSection({ counts }: { counts: { nodes: number; edges: number; evidence: number } }) {
  return (
    <section className="border-y border-line bg-band px-6 py-14">
      <div className="mx-auto max-w-[900px] text-center">
        <p className="text-meta font-semibold tracking-wide text-ink-3 uppercase">Built on real, cited research</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {SOURCES.map((s) => (
            <span key={s} className="text-ui font-medium text-ink-2">
              {s}
            </span>
          ))}
        </div>
        <p className="mt-6 text-meta text-ink-3">
          This snapshot: {counts.nodes} nodes · {counts.edges} cited edges · {counts.evidence} evidence records —
          every one links to its source.
        </p>
      </div>
    </section>
  )
}

const PROBLEMS: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; body: string }[] = [
  {
    icon: Database,
    title: 'Knowledge is scattered',
    body: 'Moving toward a treatment requires connected work — understanding the biology, gathering patient data, choosing experiments. The relevant knowledge sits across papers, disease databases, studies, and patient organizations.',
  },
  {
    icon: Repeat,
    title: 'Groups rebuild what exists',
    body: 'Another community may already have a useful registry or experimental model. A patient group cannot reuse what it cannot find — or judge whether it applies. Groups spend scarce time and funding rebuilding similar assets.',
  },
  {
    icon: GitBranch,
    title: 'Names hide mechanisms',
    body: 'Different genes can disrupt the same biological process; one gene can have different effects; similar symptoms can have different causes. Organizing by disease name misses the research a community could share.',
  },
]

export function ProblemSection() {
  return (
    <section className="px-6 py-20">
      <SectionHeading
        eyebrow="Why this exists"
        title="What keeps a patient group isolated"
        lead="Three problems named in the challenge brief this atlas is built to answer."
      />
      <div className="mx-auto mt-12 grid max-w-[1040px] gap-6 sm:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-md border border-line bg-paper p-6">
            <span className="grid size-10 place-items-center rounded-sm bg-accent-weak text-accent-ink">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-ui font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-label text-ink-2">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const STEPS: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; body: string }[] = [
  {
    icon: Search,
    title: 'Search your condition',
    body: 'Disease, gene or symptom — resolved through synonyms to one stable node, not a guess.',
  },
  {
    icon: ShieldCheck,
    title: 'See the evidence',
    body: 'Every edge shows its source, tier and confidence. Contradicting findings are shown beside it, never hidden.',
  },
  {
    icon: Sparkles,
    title: 'Get a next step',
    body: 'An action plan grounded in real assets, studies and people — or an honest account of what is still unknown.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="border-y border-line bg-band px-6 py-20">
      <SectionHeading
        eyebrow="How it works"
        title="From an isolated diagnosis to a justified next step"
      />
      <div className="mx-auto mt-12 grid max-w-[1040px] gap-6 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="relative rounded-md border border-line bg-paper p-6">
            <span className="absolute top-5 right-5 text-h2 font-bold text-line-strong">{i + 1}</span>
            <span className="grid size-10 place-items-center rounded-sm bg-accent-weak text-accent-ink">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-ui font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-label text-ink-2">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const PERSONAS: { icon: ComponentType<SVGProps<SVGSVGElement>>; name: string; role: string; quote: string }[] = [
  {
    icon: Users,
    name: 'Maria',
    role: 'Patient organization leader',
    quote:
      'We may be the only family with this diagnosis, but this pathway connects us to another community and an existing study. Here is what must be checked before we join forces.',
  },
  {
    icon: HeartHandshake,
    name: 'Devon',
    role: 'Newly diagnosed patient / caregiver',
    quote:
      'Here is the patient group for your exact diagnosis. If none exists, here are the closest related communities and how to help build the missing one.',
  },
  {
    icon: Search,
    name: 'Priya',
    role: 'Biotech / pharma scout',
    quote:
      'A ranked list of clusters matching your mechanism, each annotated with active patient advocacy groups, existing infrastructure, and named contacts.',
  },
  {
    icon: Microscope,
    name: 'Dr. Osei',
    role: 'Academic researcher / clinician-scientist',
    quote: 'Who else works on my mechanism, across every gene name that mechanism can hide under — plus a way to reach them.',
  },
]

export function PersonasSection() {
  return (
    <section className="px-6 py-20">
      <SectionHeading eyebrow="Who it's for" title="Four people, one shared map" />
      <div className="mx-auto mt-12 grid max-w-[1040px] gap-6 sm:grid-cols-2">
        {PERSONAS.map(({ icon: Icon, name, role, quote }) => (
          <div key={name} className="rounded-md border border-line bg-paper p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-weak text-accent-ink">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-ui font-semibold text-ink">{name}</p>
                <p className="text-meta text-ink-3">{role}</p>
              </div>
            </div>
            <p className="mt-4 text-label text-ink-2 italic">&ldquo;{quote}&rdquo;</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const STACK = ['Next.js', 'TypeScript', 'PostgreSQL', 'Supabase (RLS)', 'Python', 'OpenAI']

export function TechSection() {
  return (
    <section className={cn('border-y border-line bg-band px-6 py-14')}>
      <div className="mx-auto max-w-[900px] text-center">
        <p className="text-meta font-semibold tracking-wide text-ink-3 uppercase">Built with</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {STACK.map((t) => (
            <span key={t} className="rounded-full border border-line-strong px-3 py-1 text-label text-ink-2">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
