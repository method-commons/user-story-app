import { card, expect, openExample, row, storedProjects, test } from './fixtures.js';

test('Board: Spalten, Prüfung beim Verschieben, Trotzdem verschieben', async ({ page }) => {
  await openExample(page);
  await page.click('[data-nav="board"]');
  await expect(page.locator('.col-head')).toHaveText([/^Entwurf\s*4$/, /^Bereit\s*2$/, /^In Arbeit\s*1$/, /^Review\s*1$/, /^Fertig\s*2$/]);
  await expect(page.locator('#board')).toContainText('Eingang: Definition of Ready');

  // FT-5 ist nicht bereit: Dialog mit offenen Punkten
  await card(page, 'FT-5').getByRole('button', { name: 'FT-5 nach „Bereit“' }).click();
  const dlg = page.locator('#gateDialog');
  await expect(dlg).toContainText('FT-5 nach „Bereit“ verschieben?');
  await expect(dlg).toContainText('Akzeptanzkriterien vorhanden und vollständig');
  await expect(dlg).toContainText('Geschätzt');
  await expect(dlg).toContainText('Mit dem Product Owner besprochen');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('[data-status="draft"] .tcard')).toHaveCount(4);

  await card(page, 'FT-5').getByRole('button', { name: 'FT-5 nach „Bereit“' }).click();
  await page.click('#gateMove');
  await expect(page.locator('.toast').last()).toContainText('mit offenen Punkten');
  await expect(page.locator('[data-status="ready"] .tcard')).toHaveCount(3);

  // FT-7 (bereit) nach „In Arbeit“: keine Prüfung nötig
  await card(page, 'FT-7').getByRole('button', { name: 'FT-7 nach „In Arbeit“' }).click();
  await expect(page.locator('#gateDialog')).toHaveCount(0);
  await expect(page.locator('[data-status="progress"] .tcard')).toHaveCount(2);

  // Ziehen nach „Fertig“: Definition of Done offen; eigener Punkt im Dialog abhaken
  await card(page, 'FT-4').dragTo(page.locator('[data-status="done"]'));
  await expect(dlg).toContainText('Alle Akzeptanzkriterien bestätigt');
  await dlg.getByRole('checkbox').first().click();
  await expect(dlg.getByRole('checkbox')).toHaveCount(0);
  await expect(dlg).toContainText('Alle Akzeptanzkriterien bestätigt');
  await page.click('#gateMove');
  await expect(page.locator('[data-status="done"] .tcard')).toHaveCount(3);
  await expect.poll(async () => (await storedProjects(page))[0].stories.find(s => s.id === 's-pickup')).toMatchObject({ status: 'done', dod: { 'dod-po': true, 'dod-test': true } });
});

test('Statuswechsel im Editor prüft ebenfalls', async ({ page }) => {
  await openExample(page);
  await row(page, 'FT-9').locator('.text').click();
  await page.selectOption('#storyStatus', 'ready');
  await expect(page.locator('#gateDialog')).toContainText('Mit dem Product Owner besprochen');
  await page.locator('#gateDialog').getByRole('checkbox').click();
  await expect(page.locator('#gateDialog')).toContainText('Alles erfüllt.');
  await page.click('#gateMove');
  await expect(page.locator('#storyStatus')).toHaveValue('ready');
  await expect(page.locator('#dorPanel .chip')).toHaveText('5/5');
});
