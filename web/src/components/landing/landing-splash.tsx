'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ExternalLink, Waypoints } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useMeta } from '@/lib/queries'
import { HowItWorksSection, PersonasSection, ProblemSection, SourcesSection, TechSection } from './sections'

const SEEN_KEY = 'pathnet.seen-splash.v1'
const REPO_URL = 'https://github.com/NavneetKishanS/path-net'
const CLUSTER_COLORS = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)'] as const

/** A node near (x, y) with short connecting lines to a couple of neighbours -- a constellation,
 * not a real graph render. Purely decorative; never claims to be live data. */
function Constellation() {
  const nodes: [number, number][] = [
    [60, 90], [160, 40], [230, 130], [340, 60], [120, 190], [260, 220],
    [400, 170], [60, 260], [340, 290], [460, 100], [200, 300], [450, 260],
  ]
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [2, 6], [3, 9], [5, 8], [4, 10], [6, 9], [8, 11], [6, 11],
  ]
  return (
    <svg
      viewBox="0 0 520 360"
      className="pointer-events-none absolute inset-0 size-full opacity-70"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="520" height="360" fill="url(#glow)" />
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a]![0]}
          y1={nodes[a]![1]}
          x2={nodes[b]![0]}
          y2={nodes[b]![1]}
          stroke="var(--line-strong)"
          strokeWidth="1"
          strokeDasharray={i % 3 === 0 ? '3 4' : undefined}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 4 === 0 ? 5 : 3}
          fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}

function Hero({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="relative flex min-h-[86vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Constellation />
      <div className="relative flex max-w-[640px] flex-col items-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper/60 px-3 py-1 text-meta text-ink-2 backdrop-blur-sm">
          <Waypoints className="size-3.5 text-accent-ink" aria-hidden />
          Rare Disease Atlas
        </span>
        <h1 className="text-h1 font-bold tracking-tight text-ink sm:text-[2.75rem]">
          Five thousand points of light.
          <br />
          One map to see the constellations.
        </h1>
        <p className="mt-5 max-w-[48ch] text-ui text-ink-2">
          PathNet connects rare-disease research by mechanism, not name — so your community finds
          what already exists, with the evidence to back it, instead of rebuilding it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="md" onClick={onEnter} className="h-11 px-6 text-ui">
            Explore the Atlas
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="md" asChild className="h-11 px-5 text-ui">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              View the source
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

function FinalCta({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="px-6 py-20 text-center">
      <h2 className="mx-auto max-w-[560px] text-h1 font-bold text-ink">See your condition&apos;s path, not just its name.</h2>
      <Button variant="primary" size="md" onClick={onEnter} className="mt-8 h-11 px-6 text-ui">
        Explore the Atlas
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <p className="mt-8 text-meta text-ink-3">Hack-Nation × OpenAI × Buffalo Initiative — Challenge 05</p>
    </section>
  )
}

export function LandingSplash() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const meta = useMeta()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only known after hydration
    if (pathname === '/' && !localStorage.getItem(SEEN_KEY)) setVisible(true)
  }, [pathname])

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Private browsing or blocked storage: still dismiss for this visit.
    }
    setVisible(false)
  }

  if (!visible) return null
  const counts = meta.data?.counts ?? { nodes: 0, edges: 0, evidence: 0 }
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-sunken">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-sunken/90 px-6 py-3 backdrop-blur-sm">
        <span className="inline-flex items-center gap-2 text-ui font-bold text-ink">
          <Waypoints className="size-5 text-accent-ink" aria-hidden />
          PathNet
        </span>
        <Button variant="primary" size="sm" onClick={dismiss}>
          Explore the Atlas
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      </header>
      <Hero onEnter={dismiss} />
      {counts.nodes > 0 && <SourcesSection counts={counts} />}
      <ProblemSection />
      <HowItWorksSection />
      <PersonasSection />
      <TechSection />
      <FinalCta onEnter={dismiss} />
    </div>
  )
}
