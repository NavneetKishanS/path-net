import { expect, test } from '@playwright/test'

// Patient Group Leader demo path: condition -> connection -> evidence -> action.
test('leader goes from a condition to a cited connection, its evidence and an action plan', async ({ page }) => {
  await page.goto('/?role=leader')
  await expect(page.getByRole('heading', { name: 'Which condition does your group serve?' })).toBeVisible()

  const search = page.getByTestId('hero-search')
  await search.fill('DEE13')
  const option = page.getByRole('option', { name: /developmental and epileptic encephalopathy, 13/ })
  await expect(option).toContainText('matched via synonym: DEE13')
  await search.press('Enter')

  await expect(page).toHaveURL(/focus=dis_scn8a/)
  await expect(page.getByTestId('disease-title')).toHaveText('developmental and epileptic encephalopathy, 13')
  await expect(page.getByTestId('no-own-group')).toBeVisible()
  await expect(page.getByTestId('do-this-week')).toContainText('Write to FamilieSCN2A Foundation')

  await page.getByTestId('why-dis_scn2a_neonatal_epilepsy').click()
  await expect(page).toHaveURL(/\/route\?.*from=dis_scn8a/)
  await expect(page.getByTestId('route-summary')).toContainText('Inferred')
  await expect(page.getByTestId('route-steps').first().locator(':scope > li')).toHaveCount(2)
  await expect(page.getByText('What limits this link')).toBeVisible()

  await page.getByRole('button', { name: 'Open evidence: PMID 34431999' }).click()
  const drawer = page.getByRole('dialog', { name: 'Evidence' })
  await expect(drawer).toBeVisible()
  await expect(
    drawer.getByRole('link', { name: /Genotype-phenotype correlations in SCN8A-related disorders/ }),
  ).toHaveAttribute('href', /pubmed\.ncbi\.nlm\.nih\.gov\/34431999/)
  await expect(page).toHaveURL(/edge=/)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(page).not.toHaveURL(/edge=/)

  await page.getByTestId('to-action').click()
  await expect(page.getByRole('heading', { name: 'Action plan' })).toBeVisible()
  await expect(page.getByTestId('do-this-week')).toContainText('Read how SCN2A DRAGONFLY registry is set up')
  await expect(page.getByTestId('draft-outreach')).toContainText('Check every claim against its source')
  await expect(page.getByTestId('draft-outreach').locator('textarea')).toHaveValue(/PMID 34431999/)
  await expect(page).toHaveURL(/role=leader/)
})

test('a condition with only broad symptom overlap shows no supported route', async ({ page }) => {
  await page.goto('/action/dis_kcnq2?role=leader')
  await expect(page.getByTestId('no-route')).toContainText('No supported route')
  await expect(page.getByTestId('no-route')).toContainText('What was searched')
})

test('the role switcher changes the lens and keeps it in the URL', async ({ page }) => {
  await page.goto('/disease/dis_scn8a?role=leader')
  await expect(page.getByTestId('disease-title')).toBeVisible()
  await page.getByTestId('role-switcher').click()
  await page.getByRole('option', { name: /Biotech Scout/ }).click()
  await expect(page).toHaveURL(/role=scout/)
  await expect(page.getByRole('link', { name: 'Mechanisms' })).toBeVisible()
  await page.goto('/action/dis_scn8a?role=scout')
  await expect(page.getByRole('heading', { name: /is not part of this view/ })).toBeVisible()
})
