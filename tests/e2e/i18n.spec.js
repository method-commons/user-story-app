import { expect, openExample, test } from './fixtures.js';

test('Sprache auf Englisch umstellen', async ({ page }) => {
  await page.click('#menuBtn');
  await page.click('[data-lang="en"]');
  await expect(page.locator('h1')).toHaveText('My projects');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await openExample(page);
  await expect(page.locator('#projectName')).toHaveText('Food truck ordering app');
  await page.fill('#quickAdd', 'As a club treasurer, I want to see unpaid fees so that I can send reminders');
  await page.press('#quickAdd', 'Enter');
  await expect(page.locator('.story-row').last()).toContainText('As a club treasurer I want to see unpaid fees, so that I can send reminders');
  await page.click('[data-nav="board"]');
  await expect(page.locator('.col-head').first()).toContainText('Draft');
  await page.click('#menuBtn');
  await page.click('[data-lang="de"]');
  await expect(page.locator('.col-head').first()).toContainText('Entwurf');
});
