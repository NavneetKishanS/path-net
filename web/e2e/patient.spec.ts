import { expect, test } from '@playwright/test'

// Patient / Caregiver on a phone: find the exact community, or get an honest "not yet".
test('a gene name leads to the exact community for that condition', async ({ page }) => {
  await page.goto('/?role=patient')
  await expect(page.getByRole('heading', { name: 'Find your community' })).toBeVisible()

  const search = page.getByTestId('hero-search')
  await search.fill('STXBP1')
  // The gene name is also part of a synonym, so the suggestion explains the match in plain words.
  const option = page.getByRole('option', { name: /developmental and epileptic encephalopathy, 4/ })
  await expect(option).toContainText('STXBP1')
  await option.click()

  await expect(page).toHaveURL(/\/disease\/dis_stxbp1\?role=patient/)
  const community = page.getByTestId('your-community')
  await expect(community).toContainText('Your community')
  await expect(community).toContainText('STXBP1 Foundation')
  await expect(page.getByRole('heading', { name: 'Ways to take part in research' })).toBeVisible()
  // Plain detail level: no scores, no tier or relation jargon.
  await expect(page.getByText(/Tier [ABCD]/)).toHaveCount(0)
  await expect(page.getByText(/confidence/i)).toHaveCount(0)
})

test('a condition outside the atlas gets a clear no-route answer', async ({ page }) => {
  await page.goto('/?role=patient')
  const search = page.getByTestId('hero-search')
  await search.fill('CDKL5')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/search\?.*q=CDKL5/)
  const noRoute = page.getByTestId('no-route')
  await expect(noRoute).toContainText('“CDKL5” is not in this atlas yet')
  await expect(noRoute).toContainText('What we checked')
  await expect(noRoute).toContainText('What could help')
})
