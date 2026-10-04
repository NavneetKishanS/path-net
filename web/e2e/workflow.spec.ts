import { expect, test } from '@playwright/test'

// Action plan as a tracker: mark tasks done, close the ones that do not fit with a note, add your own.
test('leader tracks an action plan from the condition page', async ({ page }) => {
  await page.goto('/disease/dis_scn8a?role=leader')
  await page.getByTestId('open-action').click()
  await expect(page).toHaveURL(/\/action\/dis_scn8a\?.*role=leader/)
  await expect(page.getByRole('link', { name: 'Action plan', exact: true })).toHaveAttribute('aria-current', 'page')

  const progress = page.getByTestId('plan-progress')
  await expect(progress).toContainText('0 of 6 tasks done')

  // A done task leaves the default "To do" view, so click rather than check().
  await page.getByRole('checkbox', { name: 'Write to FamilieSCN2A Foundation' }).click()
  await expect(progress).toContainText('1 of 6 tasks done')
  await expect(page.getByTestId('task-write-partner')).toBeHidden()

  const registry = page.getByTestId('task-read-registry')
  await registry.getByRole('button', { name: /^Close task/ }).click()
  const form = registry.getByTestId('close-form')
  await expect(form.getByRole('button', { name: 'Close task' })).toBeDisabled()
  await form.getByRole('textbox').fill('Registry only covers SCN2A for now')
  await form.getByRole('button', { name: 'Close task' }).click()
  await expect(progress).toContainText('1 of 5 tasks done · 1 closed')

  await page.getByRole('button', { name: /^Closed/ }).click()
  await expect(page).toHaveURL(/show=closed/)
  await expect(registry).toHaveAttribute('data-status', 'closed')
  await expect(registry.getByTestId('close-note')).toContainText('Registry only covers SCN2A for now')

  await page.getByRole('button', { name: /^All/ }).click()
  await page.getByTestId('add-task').getByRole('textbox').fill('Book a call with the registry team')
  await page.getByTestId('add-task').getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('checkbox', { name: 'Book a call with the registry team' })).toBeVisible()
  await expect(progress).toContainText('1 of 6 tasks done · 1 closed')

  // Progress survives a reload and shows on the condition page.
  await page.reload()
  await expect(progress).toContainText('1 of 6 tasks done · 1 closed')
  await registry.getByRole('button', { name: /^Restore/ }).click()
  await expect(progress).toContainText('1 of 7 tasks done')

  await page.goto('/disease/dis_scn8a?role=leader')
  await expect(page.getByTestId('plan-progress-note')).toHaveText('1 of 7 done')
  await expect(page.getByTestId('do-this-week')).toContainText('Write to FamilieSCN2A Foundation (done)')

  // The tab reopens the plan in use; "All plans" lists it with its progress.
  await page.getByRole('link', { name: 'Action plan', exact: true }).click()
  await expect(page).toHaveURL(/\/action\/dis_scn8a/)
  await page.getByTestId('all-plans').click()
  await expect(page.getByTestId('your-plans')).toContainText('developmental and epileptic encephalopathy, 13')
  await expect(page.getByTestId('your-plans')).toContainText('1 of 7 done')
})

test('the Action plan tab is only shown to roles with the full plan', async ({ page }) => {
  await page.goto('/?role=leader')
  await expect(page.getByRole('link', { name: 'Action plan', exact: true })).toBeVisible()
  for (const role of ['patient', 'scout', 'researcher']) {
    await page.goto(`/?role=${role}`)
    await expect(page.getByTestId('role-switcher')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Action plan', exact: true })).toHaveCount(0)
  }
})
