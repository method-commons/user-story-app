import { expect, openExample, openStory, row, test } from './fixtures.js';

test('Einstellungen: Skala, Grenze, eigene Punkte der Definition of Ready', async ({ page }) => {
  await openExample(page);
  await page.click('#menuBtn');
  await page.click('[data-action="settings"]');
  await expect(page.locator('h1')).toHaveText('Projekteinstellungen');
  await page.fill('#setName', 'Truck');
  await expect(page.locator('#projectName')).toHaveText('Truck');

  await page.check('input[name="setScale"][value="points"]');
  await expect(page.locator('#setSmall')).toHaveValue('8');
  await page.selectOption('#setSmall', '3');
  await page.click('[data-add="dorItems"]');
  await page.locator('#dorItems li:not(.auto) input').last().fill('UX-Entwurf liegt vor');

  await page.click('[data-nav="backlog"]');
  await expect(page.locator('.side')).toContainText('Story Points');
  await expect(row(page, 'FT-2').locator('.size')).toHaveText('8');
  await expect(row(page, 'FT-2').locator('[data-letter="S"]')).toHaveClass(/inv-bad/);
  await openStory(page, 'FT-2');
  await expect(page.locator('#dorPanel')).toContainText('UX-Entwurf liegt vor');
  await expect(page.locator('#dorPanel .chip')).toHaveText('4/6');
});

test('Epics anlegen, benennen und löschen', async ({ page }) => {
  await openExample(page);
  await page.click('[data-nav="epics"]');
  await expect(page.locator('.epic-card')).toHaveCount(3);
  await page.click('#addEpic');
  await expect(page.locator('.epic-name').last()).toBeFocused();
  await page.locator('.epic-name').last().fill('Treueprogramm');
  await page.click('[data-nav="backlog"]');
  await page.selectOption('#filterEpic', { label: 'Treueprogramm' });
  await expect(page.locator('.story-row')).toHaveCount(0);
  await page.selectOption('#filterEpic', '');
  await expect(page.locator('.group-name')).toContainText(['Treueprogramm']);

  await page.click('[data-nav="epics"]');
  await page.locator('.epic-card').first().getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('#confirmDialog')).toContainText('Die 5 zugehörigen Stories bleiben erhalten');
  await page.click('#confirmOk');
  await expect(page.locator('.epic-card')).toHaveCount(3);
  await page.click('[data-nav="backlog"]');
  await expect(page.locator('[data-group="none"] .story-row')).toHaveCount(6);
});

test('Projekt in den Einstellungen löschen', async ({ page }) => {
  await openExample(page);
  await page.click('#menuBtn');
  await page.click('[data-action="settings"]');
  await page.click('#deleteProject');
  await page.click('#confirmOk');
  await expect(page.locator('h1')).toHaveText('Meine Projekte');
  await expect(page.locator('.intro')).toBeVisible();
});
