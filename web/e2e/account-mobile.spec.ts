import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import nextEnv from '@next/env'
import { Pool } from 'pg'

const ownedEmails: string[] = []
const { loadEnvConfig } = nextEnv
test.use({
  actionTimeout: 15_000,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

test.afterAll(async () => {
  if (!ownedEmails.length) return
  loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined })
  if (!process.env.PATHNET_ACCOUNT_DATABASE_URL)
    throw new Error('Account test cleanup requires the configured database.')
  const pool = new Pool({
    connectionString: process.env.PATHNET_ACCOUNT_DATABASE_URL,
    application_name: 'pathnet_phone_test_cleanup',
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
    throw new Error('Could not clean up this file’s temporary phone demo accounts.')
  } finally {
    client.release()
    await pool.end()
  }
})

test('phone onboarding presents two columns and guest reading works without horizontal overflow', async ({ page }) => {
  await page.goto('/')
  const chooser = page.getByRole('dialog', { name: 'Choose your role' })
  await expect(chooser).toBeVisible()
  await expect(chooser.getByRole('radio')).toHaveCount(4)
  const patient = chooser.getByText('Patient or caregiver', { exact: true })
  const leader = chooser.getByText('Patient group leader', { exact: true })
  const scout = chooser.getByText('Biotech scout', { exact: true })
  const first = await patient.boundingBox()
  const second = await leader.boundingBox()
  const third = await scout.boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(third).not.toBeNull()
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(4)
  expect(third!.y).toBeGreaterThan(first!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
  const screenshots = process.env.PATHNET_SCREENSHOTS_DIR ?? test.info().outputPath('screenshots')
  await mkdir(screenshots, { recursive: true })
  await page.screenshot({ path: join(screenshots, 'onboarding-mobile.png'), animations: 'disabled' })
  await chooser.getByRole('button', { name: 'Continue as Guest', exact: true }).click()
  await expect(page.getByTestId('hero-search')).toBeVisible()
  await page.goto('/disease/dis_stxbp1?role=patient')
  await expect(page.getByTestId('your-community')).toBeVisible()
  await page.getByRole('button', { name: 'Simple language', exact: true }).click()
  await expect(page.getByText('Caused by variants in', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Simple language', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.reload()
  await expect(page.getByText('Caused by variants in', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
})

test('phone registration completes step two and personal preferences remain editable', async ({ page }) => {
  const email = `pathnet-phone-${randomUUID()}@example.test`
  ownedEmails.push(email)
  await page.goto('/')
  const chooser = page.getByRole('dialog', { name: 'Choose your role' })
  await chooser
    .getByRole('radio', { name: /Patient or caregiver/ })
    .locator('..')
    .click()
  await chooser.getByRole('button', { name: 'Next', exact: true }).click()
  const setup = page.getByRole('dialog', { name: 'Make PathNet your own' })
  await setup.getByLabel('Display name', { exact: true }).fill('Devon Phone Demo')
  await setup.getByLabel('Email', { exact: true }).fill(email)
  await setup.getByLabel(/^Password/).fill('PathNet phone demo password!')
  await expect(setup.getByRole('radio', { name: /Simple language Short explanations/ })).toBeChecked()
  await setup.getByRole('searchbox', { name: 'Search interests' }).fill('STXBP1')
  await setup
    .getByRole('list', { name: 'Available interests' })
    .getByRole('button', { name: /^STXBP1\s*gene/ })
    .click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
  await setup.getByRole('button', { name: 'Create account & enter', exact: true }).click()
  await expect(setup).toBeHidden()
  await expect(page.getByRole('button', { name: 'Account: Devon Phone Demo', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your followed topics', exact: true })).toBeVisible()
  await page.goto('/account')
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Devon Phone Demo')
  await page.getByLabel('Display name', { exact: true }).fill('Devon Phone Saved')
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('have been saved')
  await page.reload()
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Devon Phone Saved')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
})
