'use client'

import { useState, type FormEvent } from 'react'
import { Check, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { Page, PageHeader, Pending } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { useAccount } from '@/components/account/account-provider'
import { ACCOUNT_INPUT, PreferencesForm, profileLandings } from '@/components/account/preferences-form'
import { ROLE_CONFIG, type Role } from '@/lib/roles'
import type { AccountProfile } from '@/lib/account'

export default function AccountPage() {
  const account = useAccount()
  if (!account.ready)
    return (
      <Page>
        <Pending label="Opening your workspace" lines={5} />
      </Page>
    )
  return (
    <Page>
      <PageHeader title="Profile & preferences">
        Choose how you use the atlas. Your private interests and preferences are kept separate from its public research
        records.
      </PageHeader>
      {!account.user ? (
        <div className="max-w-[600px] space-y-4 rounded-sm border border-line bg-band p-6">
          <h2 className="text-h3">You are exploring as a guest</h2>
          <p className="text-ui text-ink-2">
            Create an account to save your profile, interests and workspace preferences.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => account.openOnboarding('register')}>
              Create account
            </Button>
            <Button onClick={() => account.openOnboarding('login')}>Sign in</Button>
          </div>
        </div>
      ) : (
        <ProfileEditor key={account.user.id} />
      )}
    </Page>
  )
}

function ProfileEditor() {
  const account = useAccount()
  const [draft, setProfile] = useState<AccountProfile | null>(null)
  const profile = draft ?? account.profile
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await account.saveProfile(profile)
      setProfile(null)
      setMessage('Your profile and preferences have been saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your preferences. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const logout = async () => {
    setBusy(true)
    setError('')
    try {
      await account.logout()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const changeRole = (role: Role) => {
    const next = { ...profile, role }
    setProfile({
      ...next,
      landing: profileLandings(next).some((item) => item.value === next.landing) ? next.landing : '/',
      showAssistant: ROLE_CONFIG[role].assistant && next.showAssistant,
    })
    setMessage('')
  }
  return (
    <form onSubmit={save} className="max-w-[860px] space-y-7">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-h3">Your profile</legend>
        <label htmlFor="account-display-name" className="space-y-1.5 text-label font-medium">
          Display name
          <input
            id="account-display-name"
            value={profile.displayName}
            required
            maxLength={80}
            autoComplete="name"
            onChange={(event) => {
              setProfile({ ...profile, displayName: event.target.value })
              setMessage('')
            }}
            className={ACCOUNT_INPUT}
          />
        </label>
        <label htmlFor="account-email" className="space-y-1.5 text-label font-medium">
          Email
          <input
            id="account-email"
            type="email"
            readOnly
            value={account.user?.email ?? ''}
            className={`${ACCOUNT_INPUT} bg-surface`}
          />
          <span className="block text-meta font-normal text-ink-3">Your sign-in email.</span>
        </label>
        <label htmlFor="account-perspective" className="space-y-1.5 text-label font-medium sm:col-span-2">
          Preferred perspective
          <select
            id="account-perspective"
            value={profile.role}
            onChange={(event) => changeRole(event.target.value as Role)}
            className={ACCOUNT_INPUT}
          >
            {(['patient', 'leader', 'scout', 'researcher'] as const).map((role) => (
              <option key={role} value={role}>
                {ROLE_CONFIG[role].label}
              </option>
            ))}
            {account.user?.role === 'admin' && <option value="admin">Admin</option>}
          </select>
        </label>
      </fieldset>
      <div className="flex items-start gap-3 rounded-sm border border-line bg-surface p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
        <div>
          <p className="text-label font-semibold">Account permissions: {account.user?.role.replaceAll('_', ' ')}</p>
          <p className="mt-1 text-label text-ink-2">
            Your perspective controls the interface. Protected actions use your assigned account permissions; changing
            this preference does not grant access.
          </p>
          {account.roleStatus === 'pending' && (
            <p className="mt-2 text-label text-ink-2">
              Your selected professional role is awaiting assignment. You can browse public research while protected
              tools remain restricted.
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-line pt-6">
        <PreferencesForm
          value={profile}
          onChange={(next) => {
            setProfile(next)
            setMessage('')
          }}
          disabled={busy}
        />
      </div>
      {message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-sm border border-supports bg-supports-weak p-3 text-label text-supports"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-sm border border-contra bg-contra-weak p-3 text-label text-contra-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            'Save preferences'
          )}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </form>
  )
}
