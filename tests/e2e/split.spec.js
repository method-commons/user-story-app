import { expect, openExample, openStory, test } from './fixtures.js';

test('zu große Story in ein Epic mit Teil-Stories aufteilen', async ({ page }) => {
  await openExample(page);
  await openStory(page, 'FT-8');
  await expect(page.locator('#investPanel [data-letter="S"]')).toHaveClass(/inv-bad/);
  await page.click('#investPanel .split-btn');
  const dlg = page.locator('#splitDialog');
  await expect(dlg).toContainText('FT-8 aufteilen');
  await dlg.getByRole('radio', { name: 'Datenvarianten' }).click();
  await expect(dlg.locator('.tip')).toContainText('Je Art von Daten');
  await expect(page.locator('#sp0r')).toHaveValue('Betreiberin');
  await expect(page.locator('#sp0b')).toHaveValue('ich alles an einem Ort habe');
  await page.fill('#sp0w', 'den Tagesumsatz sehen');
  await page.fill('#sp0b', 'ich die Kasse abschließen kann');
  await page.selectOption('#sp0s', 'S');
  await page.fill('#sp1w', 'meistverkaufte Gerichte je Woche sehen');
  await page.click('#splitAddPart');
  await page.fill('#sp2w', 'einen Mindestbestand je Zutat hinterlegen');
  await expect(page.locator('#splitCreate')).toHaveText('3 Stories anlegen');
  await page.click('#splitCreate');

  await expect(page.locator('.toast').last()).toContainText('FT-8 in ein Epic mit 3 Stories umgewandelt.');
  const group = page.locator('.group', { has: page.locator('.group-name', { hasText: 'Statistiken, lagerbestand' }) });
  await expect(group.locator('.story-row .id')).toHaveText(['FT-11', 'FT-12', 'FT-13']);
  await expect(page.locator('.story-row .id', { hasText: /^FT-8$/ })).toHaveCount(0);
  await page.click('[data-nav="epics"]');
  await expect(page.locator('.epic-card')).toHaveCount(4);
});

test('aufteilen und Original behalten', async ({ page }) => {
  await openExample(page);
  await openStory(page, 'FT-2');
  await page.click('#splitBtn');
  await page.uncheck('#splitAsEpic');
  await page.fill('#sp0w', 'sofort vorbestellen');
  await page.click('#splitCreate');
  await expect(page.locator('.toast').last()).toContainText('1 Stories aus FT-2 angelegt.');
  await expect(page.locator('[data-group="e-order"] .story-row .id')).toHaveText(['FT-1', 'FT-2', 'FT-11', 'FT-3', 'FT-4', 'FT-5']);
});
