'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from 'radix-ui'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HeartHandshake,
  LoaderCircle,
  Microscope,
  Search,
  Users,
  Waypoints,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { withRole } from '@/components/role/app-link'
import { useAccount } from './account-provider'
import { ACCOUNT_INPUT, PreferencesForm } from './preferences-form'
import { defaultProfile, type AccountProfile } from '@/lib/account'
import { type Role } from '@/lib/roles'
import { cn } from '@/lib/cn'

const ROLE_CHOICES = [
  {
    role: 'patient',
    label: 'Patient or caregiver',
    description: 'Understand a condition and find a community.',
    icon: HeartHandshake,
  },
  {
    role: 'leader',
    label: 'Patient group leader',
    description: 'Connect groups, resources and next steps.',
    icon: Users,
  },
  {
    role: 'scout',
    label: 'Biotech scout',
    description: 'Explore mechanisms and research opportunities.',
    icon: Search,
  },
  { role: 'researcher', label: 'Researcher', description: 'Follow evidence and find collaborators.', icon: Microscope },
] as const

export function Onboarding() {
  const account = useAccount()
  return (
    <Dialog.Root
      open={account.ready && account.onboardingOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (account.user) account.closeOnboarding()
          else account.continueAsGuest()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/35 data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[70] flex max-h-[94dvh] w-[calc(100%_-_24px)] max-w-[940px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-line border-t-4 border-t-accent bg-paper shadow-xl outline-none data-[state=open]:animate-[sheet-in_160ms_ease-out]">
          <OnboardingContent key={account.onboardingMode} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function OnboardingContent() {
  const account = useAccount()
  const router = useRouter()
  const [mode, setMode] = useState<'register' | 'login'>(account.onboardingMode)
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<Role | null>(null)
  const [profile, setProfile] = useState<AccountProfile>(defaultProfile('patient'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const title = mode === 'login' ? 'Welcome back to PathNet' : step === 1 ? 'Choose your role' : 'Make PathNet your own'
  const guest = () => {
    // The role picker only updates local `profile` state; without this it's silently
    // discarded and continuing as guest always falls back to the account default,
    // regardless of which card was selected.
    if (role) account.setGuestProfile(profile)
    account.continueAsGuest()
    router.push('/')
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !account.configured) return
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await account.login(email.trim(), password)
      else await account.register(email.trim(), password, profile)
      account.closeOnboarding()
      if (mode === 'register') router.push(withRole(profile.landing, profile.role))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete this request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="relative shrink-0 border-b border-line px-6 pt-7 pb-5 text-center sm:px-10">
        <span className="mx-auto mb-3 inline-flex items-center gap-1.5 text-label font-semibold text-accent-ink">
          <Waypoints className="size-4" aria-hidden />
          PathNet
        </span>
        <Dialog.Title className="text-h2 text-accent-ink">{title}</Dialog.Title>
        <Dialog.Description className="mx-auto mt-2 max-w-[55ch] text-label text-ink-2">
          {mode === 'login'
            ? 'Sign in to restore your interests and workspace preferences.'
            : step === 1
              ? 'Choose the perspective that fits you. You can still explore the atlas as a guest.'
              : 'Choose how you read, what you follow and where you start.'}
        </Dialog.Description>
        {mode === 'register' && (
          <ol aria-label="Setup progress" className="mt-4 flex items-center justify-center gap-2">
            <li aria-current={step === 1 ? 'step' : undefined}>
              <span className={cn('block h-1.5 rounded-full', step === 1 ? 'w-8 bg-accent' : 'w-1.5 bg-accent')} />
              <span className="sr-only">Step 1: Choose role{step === 2 ? ', complete' : ''}</span>
            </li>
            <li aria-current={step === 2 ? 'step' : undefined}>
              <span className={cn('block h-1.5 rounded-full', step === 2 ? 'w-8 bg-accent' : 'w-1.5 bg-line-strong')} />
              <span className="sr-only">Step 2: Personalize and create account</span>
            </li>
          </ol>
        )}
        <Dialog.Close
          aria-label="Continue as guest and close setup"
          disabled={busy}
          className="absolute top-3 right-3 rounded-sm p-1.5 text-ink-3 hover:bg-surface"
        >
          <X className="size-4" aria-hidden />
        </Dialog.Close>
      </div>

      {mode === 'register' && step === 1 ? (
        <div className="overflow-y-auto px-5 py-8 sm:px-10 sm:py-10">
          <fieldset disabled={busy}>
            <legend className="sr-only">Choose your role</legend>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {ROLE_CHOICES.map(({ role: option, label, description, icon: Icon }) => (
                <label
                  key={option}
                  className={cn(
                    'relative flex min-h-[190px] cursor-pointer flex-col items-center rounded-sm border-2 px-3 py-5 text-center transition-colors',
                    role === option
                      ? 'border-accent bg-paper ring-4 ring-accent-weak'
                      : 'border-transparent bg-band hover:border-line-strong',
                  )}
                >
                  <input
                    className="sr-only peer"
                    type="radio"
                    name="onboarding-role"
                    value={option}
                    checked={role === option}
                    onChange={() => {
                      setRole(option)
                      setProfile(defaultProfile(option))
                    }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                  />
                  {role === option && <Check className="absolute top-2 right-2 size-4 text-accent-ink" aria-hidden />}
                  <span className="mb-4 grid size-12 place-items-center rounded-full bg-paper text-accent-ink">
                    <Icon className="size-7" strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="text-ui font-semibold text-ink">{label}</span>
                  <span className="mt-2 text-meta text-ink-2">{description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 text-center">
            <button type="button" className="link text-label" onClick={guest}>
              Continue as Guest
            </button>
            <p className="mt-2 text-meta text-ink-3">No account needed to search and read the evidence.</p>
            <p className="mt-1 text-meta text-ink-3">
              Your role chooses a view. Protected permissions are assigned separately.
            </p>
          </div>
          <div className="mt-9 flex items-center justify-between gap-4 border-t border-line pt-5">
            <button
              type="button"
              className="link text-label"
              onClick={() => {
                setMode('login')
                setError('')
              }}
            >
              Already have an account? Sign in
            </button>
            <Button variant="primary" disabled={!role} onClick={() => setStep(2)}>
              Next
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="min-h-0 overflow-y-auto px-5 py-6 sm:px-10">
          <div className={cn('mx-auto space-y-6', mode === 'login' && 'max-w-[460px]')}>
            {mode === 'register' && (
              <div className="rounded-sm border border-line bg-band px-4 py-3 text-label">
                <span className="font-semibold">Your perspective: </span>
                {ROLE_CHOICES.find((choice) => choice.role === role)?.label}
                <button type="button" onClick={() => setStep(1)} disabled={busy} className="link ml-3">
                  Change
                </button>
              </div>
            )}
            <fieldset disabled={busy} className={cn('grid gap-4', mode === 'register' && 'sm:grid-cols-2')}>
              <legend className="mb-3 text-ui font-semibold">
                {mode === 'register' ? 'Create your account' : 'Your account'}
              </legend>
              {mode === 'register' && (
                <label htmlFor="onboarding-name" className="space-y-1.5 text-label font-medium sm:col-span-2">
                  Display name
                  <input
                    id="onboarding-name"
                    autoFocus
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={profile.displayName}
                    onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                    className={ACCOUNT_INPUT}
                  />
                </label>
              )}
              <label htmlFor="onboarding-email" className="space-y-1.5 text-label font-medium">
                Email
                <input
                  id="onboarding-email"
                  type="email"
                  autoFocus={mode === 'login'}
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={ACCOUNT_INPUT}
                />
              </label>
              <label htmlFor="onboarding-password" className="space-y-1.5 text-label font-medium">
                Password
                <input
                  id="onboarding-password"
                  type="password"
                  required
                  minLength={mode === 'register' ? 12 : undefined}
                  maxLength={128}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={ACCOUNT_INPUT}
                />
                {mode === 'register' && (
                  <span className="block text-meta font-normal text-ink-3">Use at least 12 characters.</span>
                )}
              </label>
            </fieldset>
            {mode === 'register' && (
              <div className="border-t border-line pt-5">
                <PreferencesForm value={profile} onChange={setProfile} disabled={busy} />
              </div>
            )}
            {!account.configured && (
              <p className="rounded-sm border border-line bg-surface p-3 text-label text-ink-2" role="status">
                The account service is not connected. You can explore the atlas as a guest.
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-sm border border-contra bg-contra-weak p-3 text-label text-contra-ink">
                {error}
              </p>
            )}
            {mode === 'register' && (
              <p className="text-meta text-ink-3">
                Your preferences are private. Email verification is not available in this local demo. Professional
                permissions require an assigned role.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Button
                type="button"
                disabled={busy}
                variant="secondary"
                onClick={() => {
                  if (mode === 'login') setMode('register')
                  else setStep(1)
                  setError('')
                }}
              >
                <ArrowLeft className="size-4" aria-hidden />
                {mode === 'login' ? 'Create an account' : 'Back'}
              </Button>
              <Button type="submit" variant="primary" disabled={busy || !account.configured}>
                {busy ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : mode === 'login' ? (
                  'Sign in'
                ) : (
                  'Create account & enter'
                )}
              </Button>
            </div>
            <div className="text-center">
              <button type="button" disabled={busy} onClick={guest} className="link text-label">
                Continue as Guest
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  )
}
