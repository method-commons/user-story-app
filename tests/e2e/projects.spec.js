import { createProject, expect, openExample, row, storedProjects, test } from './fixtures.js';

test('Startseite ohne Projekte zeigt die Einführung', async ({ page }) => {
  await expect(page.locator('h1')).toHaveText('Meine Projekte');
  await expect(page.locator('.intro')).toContainText('3Cs: Card, Conversation, Confirmation');
  await page.locator('.intro button', { hasText: 'Methodik ansehen' }).click();
  await expect(page.locator('#helpDialog')).toContainText('Standardformat');
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpDialog')).toHaveCount(0);
});

test('Projekt anlegen, Story per Schnelleingabe, Speichern', async ({ page }) => {
  await page.click('#newProjectBtn');
  await page.fill('#npName', 'Vereinsportal');
  await expect(page.locator('#npKey')).toHaveValue('VER');
  await page.fill('#npKey', 'vp');
  await page.check('input[name="npScale"][value="points"]');
  await page.click('#npCreate');
  await expect(page.locator('#projectName')).toHaveText('Vereinsportal');
  await expect(page.locator('.empty h2')).toHaveText('Noch keine User Stories');

  await page.fill('#quickAdd', 'Als Kassierer möchte ich offene Beiträge sehen, damit ich rechtzeitig mahnen kann');
  await page.press('#quickAdd', 'Enter');
  await expect(page.locator('.toast')).toContainText('VP-1 angelegt.');
  await expect(row(page, 'VP-1')).toContainText('Als Kassierer möchte ich offene Beiträge sehen, damit ich rechtzeitig mahnen kann');
  await expect(page.locator('#quickAdd')).toHaveValue('');

  await page.fill('#quickAdd', 'Termine abonnieren');
  await page.press('#quickAdd', 'Enter');
  await expect(page.locator('.toast').last()).toContainText('Rolle oder Nutzen fehlen noch');
  await expect(row(page, 'VP-2').locator('.missing').first()).toHaveText('<Rolle>');

  await expect.poll(async () => (await storedProjects(page))[0].stories.map(s => s.role)).toEqual(['Kassierer', '']);
  const [p] = await storedProjects(page);
  expect(p).toMatchObject({ name: 'Vereinsportal', key: 'VP', settings: { sizeScale: 'points', smallLimit: '8' } });

  await page.reload();
  await expect(row(page, 'VP-2')).toBeVisible();
  await page.click('#homeLink');
  await expect(page.locator('.proj h2')).toHaveText('Vereinsportal');
  await expect(page.locator('.proj .meta')).toContainText('2Stories');
});

test('Beispiel öffnen und Projekt löschen mit Rückgängig', async ({ page }) => {
  await openExample(page);
  await expect(page.locator('.toast')).toContainText('Beispiel „Food-Truck Bestell-App“ geöffnet.');
  await expect(page.locator('.story-row')).toHaveCount(10);
  await page.click('#homeLink');
  await expect(page.locator('.proj .hint')).toContainText('Stories zu groß');
  await expect(page.locator('.recent .link-row')).toHaveCount(6);

  await page.locator('.proj [data-delete]').click();
  await expect(page.locator('#confirmDialog')).toContainText('mit 10 Stories');
  await page.click('#confirmOk');
  await expect(page.locator('.proj h2')).toHaveCount(0);
  await page.locator('.toast button', { hasText: 'Rückgängig' }).click();
  await expect(page.locator('.proj h2')).toHaveText('Food-Truck Bestell-App');
});

test('Backlog filtern, gruppieren und umsortieren', async ({ page }) => {
  await openExample(page);
  await page.fill('#search', 'apple pay');
  await expect(page.locator('.story-row')).toHaveCount(1);
  await page.fill('#search', '');
  await page.click('#filterProblems');
  await expect(page.locator('.story-row')).toHaveCount(3);
  await page.click('#filterProblems');
  await page.selectOption('#filterPriority', 'must');
  await expect(page.locator('.story-row')).toHaveCount(5);
  await page.selectOption('#filterPriority', '');

  await page.locator('.seg button', { hasText: 'Status' }).click();
  await expect(page.locator('.group-name')).toHaveText(['Entwurf', 'Bereit', 'In Arbeit', 'Review', 'Fertig']);
  await page.locator('.seg button', { hasText: 'Epic' }).click();
  await expect(page.locator('.group-name')).toHaveText(['Bestellen', 'Küche & Ausgabe', 'Betrieb', 'Ohne Epic']);

  // Umsortieren mit den Pfeilen
  await row(page, 'FT-2').hover();
  await row(page, 'FT-2').getByRole('button', { name: 'FT-2 nach oben' }).click();
  await expect(page.locator('[data-group="e-order"] .story-row .id')).toHaveText(['FT-2', 'FT-1', 'FT-3', 'FT-4', 'FT-5']);
  // Ziehen in ein anderes Epic
  await row(page, 'FT-9').dragTo(row(page, 'FT-6'));
  await expect(page.locator('[data-group="e-kitchen"] .story-row .id')).toHaveText(['FT-9', 'FT-6', 'FT-7']);
  // Rückgängig über die Kopfzeile
  await page.click('#undoBtn');
  await expect(page.locator('[data-group="e-ops"] .story-row .id')).toHaveText(['FT-8', 'FT-9']);
  await page.click('#redoBtn');
  await expect(page.locator('[data-group="e-ops"] .story-row .id')).toHaveText(['FT-8']);
});

test('neues Projekt mit T-Shirt-Größen über den Dialog', async ({ page }) => {
  await createProject(page, 'Lastenrad-Verleih');
  const [p] = await storedProjects(page);
  expect(p).toMatchObject({ key: 'LV', settings: { sizeScale: 'tshirt', smallLimit: 'M' } });
});
