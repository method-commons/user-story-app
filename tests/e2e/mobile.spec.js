import { expect, openExample, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

test('mobil: Navigation unten, kein seitliches Scrollen', async ({ page }) => {
  await openExample(page);
  const nav = page.locator('.nav');
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  expect(box.y + box.height).toBeGreaterThan(800);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBe(0);
  await page.locator('.story-row .text').first().click();
  await expect(page.locator('#fRole')).toBeVisible();
  expect(await overflow()).toBe(0);
  await nav.getByText('Board').click();
  await expect(page.locator('#board')).toBeVisible();
  expect(await overflow()).toBe(0);
});
