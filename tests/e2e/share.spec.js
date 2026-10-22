import { test, expect, createProject } from './fixtures.js';
import { APP, REPO, fakeGitHub } from './github.js';

/*
 * Teilen zum Ansehen aus der GitHub-Ablage: geheimes Gist, Empfänger ohne Konto und ohne Ablage,
 * nur lesend; das Öffnen eines Links speichert nichts. GitHub ist nachgebildet (./github.js).
 */

const PREFIX = 'user-stories:project:';
const docKeys = page => page.evaluate(p => Object.keys(localStorage).filter(k => k.startsWith(p)), PREFIX);
const sharedRecord = gh => JSON.parse(Object.values([...gh.gists.values()][0].files)[0].content);
const currentId = page => page.evaluate(() => location.hash.split('/')[2]);
async function menu(page, action) {
  await page.click('#menuBtn');
  await page.click(`[data-action="${action}"]`);
}
async function rename(page, name) {
  const id = await page.evaluate(() => location.hash.split('/')[2]);
  await page.evaluate(i => { location.hash = `#/p/${i}/settings`; }, id);
  await page.fill('#setName', name);
  await page.locator('#setName').press('Tab');
}

async function connect(page) {
  await menu(page, 'storage');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="next"]').click();
  await expect(dlg.locator('[data-sync="token-link"]')).toHaveAttribute('href', /contents=write&gists=write&expires_in=90/);
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('input[name="token"]').fill('github_pat_test');
  await dlg.locator('[data-sync="connect"]').click();
  await dlg.locator('[data-sync="finish"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');
}

/** Ablage einrichten, Dokument „Geteilt 1“ teilen; gibt Zustand, Kennung und Link zurück. */
async function shareOne(page) {
  const gh = await fakeGitHub(page);
  await createProject(page, 'Geteilt 1');
  await rename(page, 'Geteilt 1');
  await connect(page);
  const id = await currentId(page);
  await menu(page, 'share');
  const dlg = page.locator('#syncDialog');
  await expect(dlg).toContainText('nur ansehen können');
  await dlg.locator('[data-sync="share-create"]').click();
  const link = await dlg.locator('input[name="share-link"]').inputValue();
  expect(link).toMatch(/#g=ab[0-9a-f]{10}$/);
  await dlg.locator('button', { hasText: 'Fertig' }).click();
  return { gh, id, link };
}

async function flush(page) {
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await page.keyboard.press('Escape');
}

test('Teilen: geheimes Gist, Kennung in der Ablage, Link folgt dem Abgleich, beenden', async ({ page }) => {
  const { gh, id } = await shareOne(page);
  const gist = [...gh.gists.values()][0];
  expect(gist.public).toBe(false);
  expect(Object.keys(gist.files)).toEqual([`${APP}.json`]);
  expect(sharedRecord(gh)).toMatchObject({ app: APP, data: { name: 'Geteilt 1' } });
  await expect.poll(() => gh.read(`${APP}/${id}.json`)?.share?.gist).toBe(gist.id);
  await rename(page, 'Geteilt 2');
  await flush(page);
  await expect.poll(() => sharedRecord(gh).data.name).toBe('Geteilt 2');
  await menu(page, 'share');
  page.once('dialog', d => d.accept());
  await page.locator('#syncDialog [data-sync="share-stop"]').click();
  await expect.poll(() => gh.gists.size).toBe(0);
  await expect.poll(() => gh.read(`${APP}/${id}.json`)?.share).toBeUndefined();
});

test('Empfänger ohne Ablage: nur lesen, nichts gespeichert, Aktualisieren, Als Kopie speichern', async ({ page, browser }) => {
  const { gh, link } = await shareOne(page);
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await fakeGitHub(other, { gh });
  await other.goto(link);
  const bar = other.locator('#syncPreview[data-kind="shared"]');
  await expect(bar).toContainText('Geteilte');
  expect(other.url()).not.toContain('#g=');
  // Name steht in den Einstellungen
  const pid = await other.evaluate(() => location.hash.split('/')[2]);
  await other.evaluate(i => { location.hash = `#/p/${i}/settings`; }, pid);
  await expect(other.locator('#setName')).toHaveValue('Geteilt 1');
  await other.locator('#setName').click();
  await other.keyboard.type('xyz');
  await expect(other.locator('#setName')).toHaveValue('Geteilt 1');
  await other.waitForTimeout(500);
  expect(await docKeys(other)).toEqual([]);

  await rename(page, 'Neuer Stand');
  await flush(page);
  await expect.poll(() => sharedRecord(gh).data.name).toBe('Neuer Stand');
  await bar.locator('[data-sync="shared-refresh"]').click();
  await expect(other.locator('#setName')).toHaveValue('Neuer Stand');

  await bar.locator('[data-sync="shared-copy"]').click();
  await expect(bar).toHaveCount(0);
  await expect.poll(async () => (await docKeys(other)).length).toBe(1);
  expect(await other.evaluate(p => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith(p)))).data.name, PREFIX)).toBe('Neuer Stand (geteilt)');
  await ctx.close();
});

test('mit eingerichteter Ablage: Öffnen eines Links schreibt nichts; Schließen führt zurück', async ({ page }) => {
  const { gh, id, link } = await shareOne(page);
  const files = gh.files.size;
  const docs = (await docKeys(page)).length;
  await page.evaluate(() => { location.hash = '#/'; });
  await page.evaluate(h => { location.hash = h; }, new URL(link).hash);
  const bar = page.locator('#syncPreview[data-kind="shared"]');
  await expect(bar).toBeVisible();
  await flush(page);
  await page.waitForTimeout(500);
  expect(gh.files.size).toBe(files);
  expect((await docKeys(page)).length).toBe(docs);
  await bar.locator('[data-sync="shared-close"]').click();
  await expect(bar).toHaveCount(0);
  expect(await currentId(page)).not.toBe(id);
});

test('beendeter Link: Hinweis, keine Ansicht', async ({ page }) => {
  await fakeGitHub(page);
  await page.evaluate(() => { location.hash = '#g=abcdef1234'; });
  await expect(page.locator('.toast')).toContainText('nicht mehr gültig');
  await expect(page.locator('#syncPreview')).toHaveCount(0);
});
