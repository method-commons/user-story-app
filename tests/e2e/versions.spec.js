import { test, expect, createProject } from './fixtures.js';
import { APP, REPO, fakeGitHub } from './github.js';

/*
 * Versionen der Ablage: Liste der Stände, „Stand speichern“ (Tag), Ansehen nur lesend,
 * Wiederherstellen und „Als Kopie öffnen“. GitHub ist nachgebildet (./github.js).
 */

async function menu(page, action) {
  await page.click('#menuBtn');
  await page.click(`[data-action="${action}"]`);
}
const fileOf = id => `${APP}/${id}.json`;
/** ID des geöffneten Dokuments (aus der Adresse). */
const currentId = page => page.evaluate(() => location.hash.split('/')[2]);
async function rename(page, name) {
  const id = await page.evaluate(() => location.hash.split('/')[2]);
  await page.evaluate(i => { location.hash = `#/p/${i}/settings`; }, id);
  await page.fill('#setName', name);
  await page.locator('#setName').press('Tab');
}

/** Ablage einrichten und das geöffnete Dokument hochladen. */
async function connect(page) {
  await menu(page, 'storage');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="next"]').click();
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('input[name="token"]').fill('github_pat_test');
  await dlg.locator('[data-sync="connect"]').click();
  await dlg.locator('[data-sync="finish"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');
}

/** Zwei Stände in der Ablage: „Erster Stand“ und „Zweiter Stand“ (aktuell). */
async function twoStates(page) {
  const gh = await fakeGitHub(page);
  await createProject(page, 'Erster Stand');
  await rename(page, 'Erster Stand');
  await connect(page);
  const id = await currentId(page);
  await expect.poll(() => gh.read(fileOf(id))?.data.name).toBe('Erster Stand');
  await rename(page, 'Zweiter Stand');
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await expect.poll(() => gh.read(fileOf(id))?.data.name).toBe('Zweiter Stand');
  await page.keyboard.press('Escape'); // Details der Statusanzeige schließen
  return { gh, id };
}

test('ohne Ablage: „Versionen …“ erklärt die Ablage und führt zum Einrichten', async ({ page }) => {
  await createProject(page, 'Erster Stand');
  await menu(page, 'versions');
  const dlg = page.locator('#syncDialog');
  await expect(dlg).toContainText('Versionen gibt es mit der Ablage');
  await dlg.locator('[data-sync="setup"]').click();
  await expect(dlg.locator('[data-step="1"]')).toBeVisible();
});

test('Versionen: Liste, „Stand speichern“ überträgt sofort und legt einen Tag an', async ({ page }) => {
  const { gh, id } = await twoStates(page);
  await rename(page, 'Dritter Stand'); // gedrosselt: noch nicht übertragen
  await menu(page, 'versions');
  const dlg = page.locator('#syncDialog');
  await expect(dlg.locator('h2')).toHaveText('Versionen – Dritter Stand');
  const rows = dlg.locator('.mcs-version');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('aktuell');

  await dlg.locator('[data-sync="save-version"]').click();
  await dlg.locator('input[name="name"]').fill('vor Workshop');
  await dlg.locator('textarea[name="note"]').fill('für Freitag');
  await dlg.locator('[data-sync="save-version-confirm"]').click();
  await expect(page.locator('.toast')).toContainText('Stand „vor Workshop“ gespeichert');
  expect(gh.read(fileOf(id)).data.name).toBe('Dritter Stand');
  const day = new Date().toISOString().slice(0, 10);
  expect([...gh.refs.keys()]).toEqual([`refs/tags/${APP}/${id}/${day}-vor-workshop`]);
  expect([...gh.tags.values()][0]).toMatchObject({ message: 'vor Workshop\n\nfür Freitag\n', object: { sha: gh.commits.at(-1).sha } });

  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('vor Workshop');
  await dlg.locator('[data-sync="only-named"]').click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('für Freitag');
});

test('Ansehen: früherer Stand nur lesend, zurück zum aktuellen Stand', async ({ page }) => {
  const { gh } = await twoStates(page);
  const commits = gh.commits.length;
  await page.click('#syncStatus');
  await page.click('[data-sync="versions"]');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('.mcs-version').nth(1).locator('[data-sync="view"]').click();
  await expect(dlg).toBeHidden();
  const bar = page.locator('#syncPreview');
  await expect(bar).toContainText('Früherer Stand:');
  await expect(page.locator('#setName')).toHaveValue('Erster Stand');

  // Bearbeiten gesperrt
  await page.locator('#setName').click();
  await page.keyboard.type('xyz');
  await expect(page.locator('#setName')).toHaveValue('Erster Stand');
  await expect(page.locator('.toast').first()).toContainText('nur ansehen');

  await bar.locator('[data-sync="preview-back"]').click();
  await expect(bar).toHaveCount(0);
  await expect(page.locator('#setName')).toHaveValue('Zweiter Stand');
  await page.waitForTimeout(400);
  expect(gh.commits.length).toBe(commits);
  expect(await page.evaluate(() => Object.values(localStorage).some(v => v.includes('"name":"Erster Stand"')))).toBe(false);
});

test('Wiederherstellen als neuer Stand; „Als Kopie öffnen“ legt ein neues Dokument an', async ({ page }) => {
  const { gh, id } = await twoStates(page);
  await menu(page, 'versions');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('.mcs-version').nth(1).locator('[data-sync="view"]').click();
  await page.locator('#syncPreview [data-sync="preview-restore"]').click();
  await expect(dlg).toContainText('Früheren Stand wiederherstellen?');
  await dlg.locator('[data-sync="restore-confirm"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#syncPreview')).toHaveCount(0);
  await expect(page.locator('#setName')).toHaveValue('Erster Stand');
  await expect.poll(() => gh.read(fileOf(id))?.data.name).toBe('Erster Stand');
  expect(gh.commits.filter(c => c.path === fileOf(id)).map(c => JSON.parse(c.text).data.name)).toEqual(['Erster Stand', 'Zweiter Stand', 'Erster Stand']);

  // Bearbeiten geht wieder
  await rename(page, 'Weiter');
  await expect(page.locator('#setName')).toHaveValue('Weiter');

  await menu(page, 'versions');
  await expect(dlg.locator('.mcs-version')).toHaveCount(3);
  await dlg.locator('.mcs-version').nth(1).locator('[data-sync="restore"]').click();
  await dlg.locator('[data-sync="copy"]').click();
  await expect(dlg).toBeHidden();
  await expect.poll(() => currentId(page)).not.toBe(id);
  await expect.poll(() => [...gh.files.values()].filter(f => f.text.includes('Zweiter Stand (Stand vom')).length).toBe(1);
});
