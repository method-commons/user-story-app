import { createProject, expect, openExample, openStory, storedProjects, test } from './fixtures.js';

/** Zustand eines INVEST-Buchstabens im Editor. */
const letter = (page, l) => page.locator(`#investPanel [data-letter="${l}"]`);

test('Card: Standardformat mit Vorschau, Tipps und INVEST', async ({ page }) => {
  await createProject(page, 'Food-Truck');
  await page.click('#newStoryBtn');
  await expect(page.locator('.crumbs')).toContainText('FT-1');
  await expect(page.locator('#formatTip')).toContainText('Beginne mit der Rolle');
  await expect(page.locator('#investPanel .ring')).toHaveText('1/6');

  await page.fill('#fRole', 'Nutzer');
  await page.fill('#fWant', 'eine PostgreSQL-Datenbank verwenden');
  await expect(page.locator('#formatTip')).toContainText('„Nutzer“ ist sehr allgemein');
  await expect(letter(page, 'V')).toHaveClass(/inv-bad/);
  await expect(letter(page, 'N')).toHaveClass(/inv-warn/);
  await expect(letter(page, 'N')).toContainText('Technische Begriffe gefunden: datenbank, postgresql.');

  await page.fill('#fRole', 'hungriger Gast');
  await page.fill('#fWant', 'vorab per Handy bestellen');
  await page.fill('#fBenefit', 'ich nicht in der Schlange warte');
  await expect(page.locator('#preview')).toHaveText('Als hungriger Gast möchte ich vorab per Handy bestellen, damit ich nicht in der Schlange warte');
  await expect(page.locator('#formatTip')).toContainText('Gut formuliert');
  await expect(letter(page, 'V')).toHaveClass(/inv-ok/);
  await expect(letter(page, 'E')).toContainText('Noch nicht geschätzt');

  await page.click('[data-size="XL"]');
  await expect(letter(page, 'S')).toHaveClass(/inv-bad/);
  await expect(letter(page, 'S')).toContainText('Größe XL über der Grenze M');
  await expect(page.locator('#investPanel .split-btn')).toBeVisible();
  await page.click('[data-size="S"]');
  await expect(letter(page, 'S')).toHaveClass(/inv-ok/);
  await page.selectOption('#fPriority', 'must');
  await expect(page.locator('.story-head .chip')).toHaveText('Must have');
  await page.fill('#storyTitle', 'Vorbestellen');

  await expect(page.locator('#investPanel .ring')).toHaveText('5/6');
  await expect.poll(async () => (await storedProjects(page))[0].stories[0]).toMatchObject({
    role: 'hungriger Gast', want: 'vorab per Handy bestellen', size: 'S', priority: 'must', title: 'Vorbestellen',
  });

  // Rückgängig (außerhalb der Textfelder)
  await page.locator('#cardTab').click({ position: { x: 5, y: 5 } });
  await page.click('#undoBtn');
  await expect(page.locator('#storyTitle')).toHaveValue('');
  await page.click('#undoBtn');
  await expect(page.locator('.story-head .chip')).toHaveText('Keine Priorität');
});

test('Confirmation: Akzeptanzkriterien anlegen, prüfen, bestätigen', async ({ page }) => {
  await createProject(page, 'Food-Truck');
  await page.fill('#quickAdd', 'Als Gast möchte ich bezahlen, damit ich kein Bargeld brauche');
  await page.press('#quickAdd', 'Enter');
  await page.locator('.story-row .text').click();
  await page.click('[data-tab="confirmation"]');
  await expect(letter(page, 'T')).toContainText('Keine Akzeptanzkriterien');

  await page.click('#addGwt');
  const ac = page.locator('.ac').first();
  await expect(ac.locator('.chip.warn')).toHaveText('unvollständig');
  await expect(letter(page, 'T')).toHaveClass(/inv-warn/);
  const fields = ac.locator('textarea');
  await fields.nth(0).fill('ich habe eine Bestellung');
  await fields.nth(1).fill('ich mit Karte bezahle');
  await fields.nth(2).fill('ist die Zahlung schnell bestätigt');
  await expect(ac.locator('.chip.warn')).toHaveCount(0);
  await expect(page.locator('#confirmationTab .hint.warn')).toContainText('Unscharfe Wörter in den Kriterien: schnell');
  await fields.nth(2).fill('ist die Zahlung innerhalb von 3 Sekunden bestätigt');
  await expect(letter(page, 'T')).toHaveClass(/inv-ok/);

  await page.click('#addCheck');
  await page.locator('.ac').nth(1).locator('textarea').fill('Beleg per E-Mail');
  await expect(page.locator('[data-tab="confirmation"] em')).toHaveText('0/2 ✓');
  await ac.locator('.ac-check').check();
  await expect(page.locator('[data-tab="confirmation"] em')).toHaveText('1/2 ✓');
  await expect(page.locator('#dodPanel [data-check="confirmed"] .check-auto')).toHaveText('✕');

  // Format umschalten nimmt den Inhalt mit
  await page.locator('.ac').nth(1).getByRole('radio', { name: 'Gegeben/Wenn/Dann' }).click();
  await expect(page.locator('.ac').nth(1).locator('textarea').nth(2)).toHaveValue('Beleg per E-Mail');
  // Reihenfolge und Löschen
  await page.locator('.ac').nth(1).getByRole('button', { name: 'nach oben' }).click();
  await expect(page.locator('.ac').first().locator('.ac-num')).toHaveText('AK 1');
  await expect(page.locator('.ac').first().locator('textarea').nth(2)).toHaveValue('Beleg per E-Mail');
  await page.locator('.ac').first().getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.ac')).toHaveCount(1);
  await page.locator('.ac-check').uncheck();
  await page.locator('.ac-check').check();
  await expect(page.locator('#dodPanel [data-check="confirmed"] .check-auto')).toHaveText('✓');
});

test('Conversation: Fragen, Entscheidungen, Übernahme als Kriterium', async ({ page }) => {
  await openExample(page);
  await openStory(page, 'FT-5');
  await expect(letter(page, 'E')).toContainText('Noch nicht geschätzt');
  await page.click('[data-tab="conversation"]');
  await expect(page.locator('.conv')).toHaveCount(1);
  await expect(page.locator('[data-tab="conversation"] em')).toHaveText('1 · 1?');

  await page.fill('#convAuthor', 'Sven');
  await page.click('[data-kind="decision"]');
  await page.fill('#convText', 'Lieblingsbestellung ohne Konto, gespeichert auf dem Gerät.');
  await page.press('#convText', 'Control+Enter');
  await expect(page.locator('.conv')).toHaveCount(2);
  await expect(page.locator('.conv').nth(1)).toContainText('Sven');
  await expect(page.locator('.conv').nth(1).locator('.avatar')).toHaveText('S');

  await page.locator('[data-to-criterion]').click();
  await expect(page.locator('.conv').nth(1).locator('.chip.good')).toHaveText('→ AK 1');
  await page.locator('.conv').first().getByRole('checkbox', { name: 'beantwortet' }).check();
  await expect(page.locator('[data-tab="conversation"] em')).toHaveText('2');

  await page.click('[data-tab="confirmation"]');
  await expect(page.locator('.ac textarea')).toHaveValue('Lieblingsbestellung ohne Konto, gespeichert auf dem Gerät.');
  await page.click('[data-tab="card"]');
  await page.click('[data-size="S"]');
  await expect(letter(page, 'E')).toHaveClass(/inv-ok/);
  await expect(letter(page, 'T')).toHaveClass(/inv-ok/);

  // Name wird gemerkt
  await page.reload();
  await page.click('[data-tab="conversation"]');
  await expect(page.locator('#convAuthor')).toHaveValue('Sven');
});

test('INVEST-Hinweis bestätigen, Abhängigkeiten, Kopieren und Löschen', async ({ page }) => {
  await openExample(page);
  await openStory(page, 'FT-10');
  await expect(letter(page, 'N')).toHaveClass(/inv-warn/);
  await letter(page, 'N').getByRole('checkbox').check();
  await expect(letter(page, 'N')).toHaveClass(/inv-ok/);
  await expect(letter(page, 'N')).toContainText('(von dir bestätigt)');
  await expect(letter(page, 'V').getByRole('checkbox')).toBeDisabled();

  await page.selectOption('#addDep', { label: 'FT-9 · Sehen, wo der Truck heute steht' });
  await expect(page.locator('#deps .chip')).toContainText('FT-9');
  await expect(letter(page, 'I')).toHaveClass(/inv-warn/);
  await page.getByRole('button', { name: 'Abhängigkeit von FT-9 entfernen' }).click();
  await expect(letter(page, 'I')).toHaveClass(/inv-ok/);

  await page.click('#prevStory');
  await expect(page.locator('.crumbs .id')).toHaveText('FT-9');
  await page.click('#duplicateBtn');
  await expect(page.locator('.crumbs .id')).toHaveText('FT-11');
  await page.click('#deleteStoryBtn');
  await page.click('#confirmOk');
  await expect(page.locator('#storyList')).toBeVisible();
  await expect(page.locator('.story-row')).toHaveCount(10);
  await page.locator('.toast button', { hasText: 'Rückgängig' }).click();
  await expect(page.locator('.story-row')).toHaveCount(11);
});
