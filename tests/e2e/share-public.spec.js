import { test, expect, createProject } from './fixtures.js';
import { APP, REPO, fakeGitHub } from './github.js';

/*
 * Teilen aus einem öffentlichen Repo: Link direkt auf die Datei (kein Gist), aktueller oder fester Stand;
 * Empfänger lesen ohne Konto über raw.githubusercontent.com, nichts wird gespeichert. GitHub ist nachgebildet.
 */

const PREFIX = 'user-stories:project:';
const docKeys = page => page.evaluate(p => Object.keys(localStorage).filter(k => k.startsWith(p)), PREFIX);
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

/** Angezeigter Name des Dokuments (nur lesend). */
const shownName = async page => { const pid = await page.evaluate(() => location.hash.split('/')[2]); await page.evaluate(i => { location.hash = `#/p/${i}/settings`; }, pid); return page.locator('#setName').inputValue(); };

async function flush(page) {
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await page.keyboard.press('Escape');
}

/** Öffentliche Ablage einrichten, Dokument „Offen 1“ anlegen und „Teilen …“ öffnen. */
async function openPublicShare(page) {
  const gh = await fakeGitHub(page);
  gh.public = true;
  await createProject(page, 'Offen 1');
  await rename(page, 'Offen 1');
  await connect(page);
  const id = await currentId(page);
  await menu(page, 'share');
  const dlg = page.locator('#syncDialog [data-sync="share-public"]');
  await expect(dlg).toContainText('öffentliches Repo');
  return { gh, id, dlg };
}

/** Empfänger in einem eigenen Browser (ohne Ablage). */
async function recipient(browser, gh) {
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await fakeGitHub(other, { gh });
  await other.goto('http://localhost:4173/');
  return { ctx, other };
}

test('öffentliches Repo: Link sofort, ohne Gist und ohne „Teilen beenden“; Empfänger liest ohne Konto', async ({ page, browser }) => {
  const { gh, id, dlg } = await openPublicShare(page);
  const input = dlg.locator('input[name="share-link"]');
  await expect(input).toHaveValue(new RegExp(`#p=${REPO}/${id}$`));
  await expect(dlg.locator('[data-sync="share-create"], [data-sync="share-stop"]')).toHaveCount(0);
  await expect(dlg).toContainText('„Teilen beenden“ gibt es hier nicht');
  expect(gh.gists.size).toBe(0);
  expect(gh.read(`${APP}/${id}.json`)?.data.name).toBe('Offen 1');
  const link = await input.inputValue();
  await dlg.locator('button', { hasText: 'Fertig' }).click();

  const { ctx, other } = await recipient(browser, gh);
  const before = await docKeys(other);
  await other.goto(link);
  const bar = other.locator('#syncPreview[data-kind="shared"]');
  await expect(bar).toContainText(`aus ${REPO}`);
  await expect(bar.locator('[data-sync="shared-origin"]')).toHaveAttribute('href', `https://github.com/${REPO}`);
  expect(await shownName(other)).toBe('Offen 1');
  expect(other.url()).not.toContain('#p=');
  await other.waitForTimeout(400);
  expect(await docKeys(other)).toEqual(before);

  // Besitzer ändert, Empfänger aktualisiert selbst
  await rename(page, 'Offen 2');
  await flush(page);
  await expect.poll(() => gh.read(`${APP}/${id}.json`)?.data.name).toBe('Offen 2');
  await bar.locator('[data-sync="shared-refresh"]').click();
  await expect.poll(() => shownName(other)).toBe('Offen 2');
  await ctx.close();
});

test('fester Stand: benannter Stand im Link, Empfänger ohne „Aktualisieren“, aktuellen Stand öffnen', async ({ page, browser }) => {
  const { gh } = await openPublicShare(page);
  await page.keyboard.press('Escape');
  await menu(page, 'versions');
  const ver = page.locator('#syncDialog');
  await ver.locator('[data-sync="save-version"]').click();
  await ver.locator('input[name="name"]').fill('vor Workshop');
  await ver.locator('[data-sync="save-version-confirm"]').click();
  await expect(ver.locator('.mcs-version.is-named [data-sync="version-link"]')).toHaveText('Link kopieren');
  await page.keyboard.press('Escape');
  await rename(page, 'Offen 2');
  await flush(page);

  await menu(page, 'share');
  const dlg = page.locator('#syncDialog [data-sync="share-public"]');
  await dlg.locator('input[value="fixed"]').check();
  await expect(dlg.locator('select[name="share-version"]')).toContainText('vor Workshop');
  await expect(dlg).toContainText('ändert sich nicht');
  const link = await dlg.locator('input[name="share-link"]').inputValue();
  expect(link).toMatch(/@[0-9a-f]{40}$/);
  await dlg.locator('input[value="current"]').check();
  await expect(dlg.locator('input[name="share-link"]')).not.toHaveValue(/@/);

  const { ctx, other } = await recipient(browser, gh);
  await other.goto(link);
  const bar = other.locator('#syncPreview[data-kind="shared"]');
  await expect(bar).toHaveAttribute('data-fixed', 'true');
  await expect(bar).toContainText('fester Stand');
  expect(await shownName(other)).toBe('Offen 1');
  await expect(bar.locator('[data-sync="shared-refresh"]')).toHaveCount(0);
  await bar.locator('[data-sync="shared-latest"]').click();
  await expect(bar).not.toHaveAttribute('data-fixed', 'true');
  await expect.poll(() => shownName(other)).toBe('Offen 2');
  await ctx.close();
});

test('privates Repo einer Organisation: Hinweis vorab, Teilen über Gist bleibt', async ({ page }) => {
  const gh = await fakeGitHub(page);
  gh.org = true;
  await createProject(page, 'Offen 1');
  await connect(page);
  await menu(page, 'share');
  const dlg = page.locator('#syncDialog');
  await expect(dlg).toContainText('Das Repo gehört der Organisation „team“ und ist privat.');
  await expect(dlg.locator('[data-sync="share-create"]')).toBeVisible();
  await expect(dlg.locator('[data-sync="share-public"]')).toHaveCount(0);
});

test('Link auf eine fehlende Datei bzw. ein privates Repo: Hinweis, keine Ansicht', async ({ page }) => {
  await fakeGitHub(page);
  await page.evaluate(r => { location.hash = `#p=${r}/fehlt`; }, REPO);
  await expect(page.locator('.toast')).toContainText('nicht (mehr) gültig');
  await expect(page.locator('#syncPreview')).toHaveCount(0);
});
