import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';

/** Gebaute App, ausgeliefert von `vite preview` (siehe playwright.config.js). */
export const APP_URL = 'http://localhost:4173/';

/**
 * `page` öffnet die App mit leerem Speicher und lässt den Test bei jedem
 * JavaScript-Fehler der Seite fehlschlagen.
 */
export const test = base.extend({
  // Playwright verlangt hier ein Objektmuster als ersten Parameter
  // eslint-disable-next-line no-empty-pattern
  pageErrors: async ({}, use) => { await use([]); },
  page: async ({ page, pageErrors }, use) => {
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(APP_URL);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await use(page);
    expect(pageErrors, 'JavaScript-Fehler auf der Seite').toEqual([]);
  },
});
export { expect };

/** Beispielprojekt öffnen (landet im Backlog). */
export async function openExample(page) {
  await page.click('#exampleBtn');
  await expect(page.locator('#storyList')).toBeVisible();
}

/** Neues Projekt über den Dialog anlegen. */
export async function createProject(page, name, opts = {}) {
  await page.click('#newProjectBtn');
  await page.fill('#npName', name);
  if (opts.scale) await page.check(`input[name="npScale"][value="${opts.scale}"]`);
  await page.click('#npCreate');
  await expect(page.locator('#quickAdd')).toBeVisible();
}

/** Zeile einer Story im Backlog über ihren Code (z. B. „FT-2“). */
export function row(page, code) {
  return page.locator('.story-row', { has: page.locator('.id', { hasText: new RegExp(`^${code}$`) }) });
}

/** Karte einer Story auf dem Board. */
export function card(page, code) {
  return page.locator('.tcard', { has: page.locator('.id', { hasText: new RegExp(`^${code}$`) }) });
}

/** Story über ihren Code öffnen. */
export async function openStory(page, code) {
  await row(page, code).locator('.text').click();
  await expect(page.locator('#storyTitle')).toBeVisible();
}

/** Gespeicherte Projekte aus dem localStorage. */
export function storedProjects(page) {
  return page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('user-stories:project:')).map(k => JSON.parse(localStorage.getItem(k))));
}

/** Download auslösen und Inhalt lesen. */
export async function download(page, action) {
  const [dl] = await Promise.all([page.waitForEvent('download'), action()]);
  return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8') };
}

/** Datei über den Dateiauswahl-Dialog der App einlesen. */
export async function chooseFile(page, button, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(button)]);
  await chooser.setFiles(file);
}
