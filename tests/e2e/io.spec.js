import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chooseFile, download, expect, openExample, storedProjects, test } from './fixtures.js';

test('Projekt exportieren und wieder importieren', async ({ page }) => {
  await openExample(page);
  await page.click('#menuBtn');
  const json = await download(page, () => page.click('[data-action="export"]'));
  expect(json.name).toBe('food-truck-bestell-app.json');
  const data = JSON.parse(json.text);
  expect(data).toMatchObject({ version: 1, key: 'FT', name: 'Food-Truck Bestell-App' });
  expect(data.stories).toHaveLength(10);

  const file = path.join(os.tmpdir(), `us-${Date.now()}.json`);
  // identisch → übersprungen
  fs.writeFileSync(file, json.text);
  await page.click('#homeLink');
  await chooseFile(page, '#importBtn', file);
  await expect(page.locator('.toast').last()).toContainText('0 Projekt(e) importiert, 1 bereits vorhanden');
  // geändert → als Kopie
  fs.writeFileSync(file, JSON.stringify({ ...data, name: 'Food-Truck v2' }));
  await page.click('#homeLink');
  await chooseFile(page, '#importBtn', file);
  await expect(page.locator('#projectName')).toHaveText('Food-Truck v2 (Import)');
  expect(await storedProjects(page)).toHaveLength(2);
  // ungültig
  fs.writeFileSync(file, '{kaputt');
  await page.click('#homeLink');
  await chooseFile(page, '#importBtn', file);
  await expect(page.locator('.toast').last()).toContainText('kein gültiges Projekt');
  fs.unlinkSync(file);
});

test('Sicherung aller Projekte und Markdown-Bericht', async ({ page }) => {
  await openExample(page);
  await page.click('[data-nav="report"]');
  await expect(page.locator('.story-card')).toHaveCount(10);
  await page.uncheck('#reportDone');
  await expect(page.locator('.story-card')).toHaveCount(8);
  const md = await download(page, () => page.click('#reportMd'));
  expect(md.name).toBe('food-truck-bestell-app.md');
  expect(md.text).toContain('### FT-2 · Vorbestellung aufgeben');
  expect(md.text).not.toContain('### FT-1 ');

  await page.click('#homeLink');
  const backup = await download(page, () => page.click('#backupBtn'));
  expect(backup.name).toMatch(/^user-stories-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(backup.text)).toMatchObject({ type: 'user-stories-backup', projects: [{ name: 'Food-Truck Bestell-App' }] });
});
