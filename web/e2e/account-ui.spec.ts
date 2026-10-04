import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import nextEnv from '@next/env'
import { Pool } from 'pg'

const password = 'PathNet private UI demo 2026!'
const { loadEnvConfig } = nextEnv
const ownedEmails: string[] = []
test.use({ actionTimeout: 15_000 })

async function screenshot(page: Page, name: string) {
  const directory = process.env.PATHNET_SCREENSHOTS_DIR ?? test.info().outputPath('screenshots')
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: join(directory, name), animations: 'disabled' })
}

function identity() {
  const email = `pathnet-ui-${randomUUID()}@example.test`
  ownedEmails.push(email)
  return { email, name: 'Devon UI Test' }
}

async function createThroughUI(
  page: Page,
  role: 'patient' | 'leader' | 'researcher',
  options: { topics?: boolean; table?: boolean } = {},
) {
  const user = identity()
  await page.goto('/')
  const chooser = page.getByRole('dialog', { name: 'Choose your role' })
  await expect(chooser).toBeVisible()
  await chooser
    .getByRole('radio', {
      name: role === 'patient' ? /Patient or caregiver/ : role === 'leader' ? /Patient group leader/ : /Researcher/,
    })
    .locator('..')
    .click()
  await chooser.getByRole('button', { name: 'Next', exact: true }).click()
  const setup = page.getByRole('dialog', { name: 'Make PathNet your own' })
  await expect(setup).toBeVisible()
  await setup.getByLabel('Display name', { exact: true }).fill(user.name)
  await setup.getByLabel('Email', { exact: true }).fill(user.email)
  await setup.getByLabel(/^Password/).fill(password)
  if (options.topics) {
    await setup.getByRole('searchbox', { name: 'Search interests' }).fill('STXBP1')
    await setup
      .getByRole('list', { name: 'Available interests' })
      .getByRole('button', { name: /^STXBP1\s*gene/ })
      .click()
    await setup.getByRole('searchbox', { name: 'Search interests' }).fill('STXBP1')
    await setup
      .getByRole('list', { name: 'Available interests' })
      .getByRole('button', { name: /developmental and epileptic encephalopathy, 4/ })
      .click()
  }
  if (options.table) {
    await setup.getByLabel(/^Map view/).selectOption('table')
    await setup.getByLabel(/^Start page/).selectOption('/explore')
  }
  const response = page.waitForResponse(
    (res) => res.url().endsWith('/api/account/register') && res.request().method() === 'POST',
  )
  await setup.getByRole('button', { name: 'Create account & enter', exact: true }).click()
  expect((await response).status()).toBe(201)
  await expect(setup).toBeHidden()
  await expect(page.getByRole('button', { name: `Account: ${user.name}`, exact: true })).toBeVisible()
  return user
}

async function signOut(page: Page, name: string) {
  await page.getByRole('button', { name: `Account: ${name}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
}

test.afterAll(async () => {
  if (!ownedEmails.length) return
  loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined })
  if (!process.env.PATHNET_ACCOUNT_DATABASE_URL)
    throw new Error('Account test cleanup requires the configured database.')
  const pool = new Pool({
    connectionString: process.env.PATHNET_ACCOUNT_DATABASE_URL,
    application_name: 'pathnet_ui_test_cleanup',
  })
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await client.query<{ id: string }>(
      'select id from pathnet_private.accounts where email = any($1::text[])',
      [ownedEmails],
    )
    const ids = result.rows.map((row) => row.id)
    if (ids.length) {
      await client.query('delete from public.user_roles where user_id = any($1::uuid[])', [ids])
      await client.query(
        'delete from pathnet_private.accounts where id = any($1::uuid[]) and email = any($2::text[])',
        [ids, ownedEmails],
      )
    }
    await client.query('commit')
  } catch {
    await client.query('rollback')
    throw new Error('Could not clean up this file’s temporary demo accounts.')
  } finally {
    client.release()
    await pool.end()
  }
})

test('a fresh visitor chooses one of four roles or continues as a guest', async ({ page }) => {
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: 'Choose your role' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio')).toHaveCount(4)
  await expect(dialog.getByText('Admin', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await screenshot(page, 'onboarding-desktop.png')
  await dialog
    .getByRole('radio', { name: /Patient or caregiver/ })
    .locator('..')
    .click()
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  const setup = page.getByRole('dialog', { name: 'Make PathNet your own' })
  await expect(setup.getByRole('radio', { name: /Simple language Short explanations/ })).toBeChecked()
  await screenshot(page, 'onboarding-preferences-desktop.png')
  await setup.getByRole('button', { name: 'Back', exact: true }).click()
  await dialog.getByRole('button', { name: 'Continue as Guest', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('hero-search')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('hero-search')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Choose your role' })).toHaveCount(0)
  await page.goto('/admin?role=admin')
  await expect(page.getByRole('heading', { name: 'Administration requires an assigned role' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
})

test('patient registration saves followed topics, profile, reading and theme preferences across login', async ({
  page,
}) => {
  const user = await createThroughUI(page, 'patient', { topics: true })
  await expect(page.getByRole('button', { name: 'Simple language', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const topics = page.getByRole('region', { name: 'Your followed topics' })
  await expect(topics.getByRole('link', { name: 'STXBP1', exact: true })).toBeVisible()
  await expect(
    topics.getByRole('link', { name: 'developmental and epileptic encephalopathy, 4', exact: true }),
  ).toBeVisible()
  await page.goto('/account')
  await page.getByLabel('Display name', { exact: true }).fill('Devon Saved Profile')
  await page.getByRole('radio', { name: /Standard A clear overview/ }).check()
  await page.getByLabel(/^Appearance/).selectOption('dark')
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('have been saved')
  await page.reload()
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Devon Saved Profile')
  await expect(page.getByLabel(/^Email/)).toHaveValue(user.email)
  await expect(page.getByRole('radio', { name: /Standard A clear overview/ })).toBeChecked()
  await expect(page.getByLabel(/^Appearance/)).toHaveValue('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await signOut(page, 'Devon Saved Profile')
  await page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true }).click()
  const login = page.getByRole('dialog', { name: 'Welcome back to PathNet' })
  await login.getByLabel('Email', { exact: true }).fill(user.email)
  await login.getByLabel('Password', { exact: true }).fill(password)
  await login.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(login).toBeHidden()
  await page.goto('/account')
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Devon Saved Profile')
  await expect(page.getByRole('radio', { name: /Standard A clear overview/ })).toBeChecked()
  await expect(page.getByLabel(/^Appearance/)).toHaveValue('dark')
  await expect(page.getByRole('list', { name: 'Selected interests' })).toContainText('STXBP1')
  await page.goto('/admin?role=admin')
  await expect(page.getByRole('heading', { name: 'Administration requires an assigned role' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
})

test('a different preferred role can switch to patient simple language without changing account permissions', async ({
  page,
}) => {
  await createThroughUI(page, 'leader')
  await page.goto('/disease/dis_stxbp1?role=patient')
  await expect(page.getByTestId('disease-title')).toBeVisible()
  await expect(page.getByTestId('your-community')).toBeVisible()
  await page.getByRole('button', { name: 'Simple language', exact: true }).click()
  await expect(page.getByText('Caused by variants in', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recorded symptoms', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Simple language', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.getByRole('button', { name: 'Simple language', exact: true }).click()
  await expect(page.getByTestId('your-community')).toBeVisible()
  await page
    .getByRole('button', { name: /^Open evidence:/ })
    .first()
    .click()
  const evidence = page.getByRole('dialog', { name: 'Evidence', exact: true })
  await expect(evidence.getByTestId('plain-evidence')).toBeVisible()
  await evidence.getByText('Read original wording and source quotations', { exact: true }).click()
  await expect(evidence.getByTestId('original-evidence')).toHaveAttribute('open', '')
  await expect(evidence.locator('blockquote').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/account')
  await page.getByRole('radio', { name: /Standard A clear overview/ }).check()
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('have been saved')
  await page.goto('/disease/dis_stxbp1?role=patient')
  await page
    .getByRole('button', { name: /^Open evidence:/ })
    .first()
    .click()
  await expect(page.getByRole('dialog', { name: 'Evidence', exact: true }).getByTestId('plain-evidence')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Evidence', exact: true }).locator('blockquote').first()).toBeVisible()
  const session = await page.request.get('/api/account/session')
  expect((await session.json()).user.role).toBe('family')
})

for (const role of ['leader', 'researcher'] as const) {
  test(`${role} can choose the existing map table as a saved start page`, async ({ page }) => {
    await createThroughUI(page, role, { table: true })
    await expect(page).toHaveURL(new RegExp(`/explore\\?role=${role}`))
    await expect(page.getByRole('button', { name: 'Show as map', exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Show as map', exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })
}

test('a delayed old session refresh cannot resurrect a signed-out account', async ({ page }) => {
  const user = await createThroughUI(page, 'patient')
  let captured!: () => void
  const capturedResponse = new Promise<void>((resolve) => {
    captured = resolve
  })
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let completed!: () => void
  const completedResponse = new Promise<void>((resolve) => {
    completed = resolve
  })
  let held = false
  await page.route('**/api/account/session', async (route) => {
    if (held) {
      await route.continue()
      return
    }
    held = true
    const response = await route.fetch()
    captured()
    await released
    await route.fulfill({ response })
    completed()
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await capturedResponse
  await signOut(page, user.name)
  release()
  await completedResponse
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Account: ${user.name}`, exact: true })).toHaveCount(0)
  expect((await (await page.request.get('/api/account/session')).json()).user).toBeNull()
})
