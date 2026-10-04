import { expect, test } from '@playwright/test'

test('leader asks the atlas: a suggestion fills the box, the answer is cited and opens its evidence', async ({
  page,
}) => {
  await page.goto('/?role=leader&focus=dis_scn8a')
  await page.getByRole('button', { name: 'Ask the atlas' }).click()

  const panel = page.getByTestId('chat-panel')
  const suggestion = panel.getByRole('button', { name: 'Which communities share a mechanism with DEE13?' })
  await suggestion.click()
  const input = panel.getByTestId('chat-input')
  await expect(input).toHaveValue('Which communities share a mechanism with DEE13?')
  await expect(panel.getByTestId('chat-answer')).toHaveCount(0)

  await input.press('Enter')
  const answer = panel.getByTestId('chat-answer').last()
  await expect(answer).toContainText('SCN2A-related neonatal-onset epilepsy subgroup')
  await expect(answer).toContainText('Contradicts')

  await answer.getByRole('button', { name: 'Open evidence: PMID 37578743' }).click()
  await expect(page).toHaveURL(/edge=/)
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/edge=/)
  await expect(panel).toBeVisible()

  await input.fill('What about CDKL5?')
  await input.press('Enter')
  await expect(panel.getByTestId('chat-answer').last()).toContainText('CDKL5 is not in this atlas')
})

test('only the Patient Group Leader and Researcher get the chat', async ({ page }) => {
  for (const [role, visible] of [
    ['leader', true],
    ['researcher', true],
    ['patient', false],
    ['scout', false],
    ['admin', false],
  ] as const) {
    await page.goto(`/?role=${role}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ask the atlas' })).toHaveCount(visible ? 1 : 0)
  }
})
