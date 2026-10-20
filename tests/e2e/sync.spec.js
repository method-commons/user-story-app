import fs from 'node:fs';
import { test, expect, createProject, openExample, storedProjects } from './fixtures.js';

/** Menü „Datei“ öffnen und Eintrag wählen. */
async function menu(page, action) {
  await page.click('#menuBtn');
  await page.click(`[data-action="${action}"]`);
}

/*
 * Ablage (method-commons/sync) mit einer Nachbildung der GitHub-API: Dateien mit sha, Ändern nur
 * auf dem aktuellen Stand – wie das echte Repo. Ein „anderes Gerät“ schreibt direkt in `gh.files`.
 */

const APP = 'user-story-app';
const PREFIX = 'user-stories:project:';
const REPO = 'team/methoden';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-github-api-version, accept',
  'access-control-allow-methods': 'GET, PUT, DELETE',
};

async function fakeGitHub(page, { files = {} } = {}) {
  const gh = { files: new Map(), messages: [], n: 0, requests: 0 };
  gh.write = (path, record) => gh.files.set(path, { sha: `sha${++gh.n}`, text: JSON.stringify(record, null, 2) });
  gh.read = path => (gh.files.has(path) ? JSON.parse(gh.files.get(path).text) : null);
  for (const [path, record] of Object.entries(files)) gh.write(path, record);

  await page.route('https://api.github.com/**', async route => {
    gh.requests++;
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.headers().authorization !== 'Bearer github_pat_test') return json(401, { message: 'Bad credentials' });
    if (url.pathname === `/repos/${REPO}`) return json(200, { full_name: REPO, private: true });
    const m = url.pathname.match(new RegExp(`^/repos/${REPO}/contents/(.+)$`));
    if (!m) return json(404, { message: 'Not Found' });
    const path = decodeURIComponent(m[1]);
    const cur = gh.files.get(path);
    if (method === 'GET') {
      if (cur) return json(200, { type: 'file', sha: cur.sha, content: Buffer.from(cur.text).toString('base64') });
      const dir = [...gh.files].filter(([p]) => p.startsWith(`${path}/`)).map(([p, f]) => ({ type: 'file', name: p.slice(path.length + 1), sha: f.sha }));
      return dir.length ? json(200, dir) : json(404, { message: 'Not Found' });
    }
    const body = JSON.parse(req.postData() || '{}');
    if (method === 'PUT') {
      if (cur && body.sha !== cur.sha) return json(cur && !body.sha ? 422 : 409, { message: 'sha does not match' });
      const sha = `sha${++gh.n}`;
      gh.files.set(path, { sha, text: Buffer.from(body.content, 'base64').toString('utf8') });
      gh.messages.push(body.message);
      return json(cur ? 200 : 201, { content: { sha } });
    }
    if (method === 'DELETE') {
      if (!cur) return json(404, { message: 'Not Found' });
      if (body.sha !== cur.sha) return json(409, { message: 'sha does not match' });
      gh.files.delete(path);
      gh.messages.push(body.message);
      return json(200, {});
    }
    return json(405, {});
  });
  return gh;
}

const fileOf = id => `${APP}/${id}.json`;
/** ID einer gespeicherten Matrix anhand ihres Namens. */
const idOf = (page, name) => page.evaluate(([prefix, n]) => Object.keys(localStorage).find(k => k.startsWith(prefix) && JSON.parse(localStorage.getItem(k)).data.name === n)?.slice(prefix.length), [PREFIX, name]);
/** Umbenennen, wie es die App tut. */
async function rename(page, name) {
  const id = await page.evaluate(() => location.hash.split('/')[2]);
  await page.evaluate(i => { location.hash = `#/p/${i}/settings`; }, id);
  await page.fill('#setName', name);
  await page.locator('#setName').press('Tab');
}

/** Ablage über den Assistenten einrichten (bis Schritt 3). */
async function connect(page) {
  await menu(page, 'storage');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="next"]').click();
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('input[name="token"]').fill('github_pat_test');
  await dlg.locator('[data-sync="connect"]').click();
  await expect(dlg.locator('[data-step="3"]')).toBeVisible();
  return dlg;
}

/** Den Abgleich anstoßen, als käme das Gerät wieder online. */
const nudge = page => page.evaluate(() => window.dispatchEvent(new Event('online')));

test('ohne Ablage: nur der Menüeintrag, keine Anzeige und keine Anfragen an GitHub', async ({ page }) => {
  const gh = await fakeGitHub(page);
  await createProject(page, 'Ohne Ablage');
  await page.click('#menuBtn');
  await expect(page.locator('[data-action="storage"]')).toHaveText(/Ablage …\s*nicht eingerichtet/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#syncStatus')).toHaveCount(0);
  await rename(page, 'Etwas geändert');
  await page.waitForTimeout(500);
  expect(gh.requests).toBe(0);
});

test('Einrichten, übertragen, Änderungen eines anderen Geräts übernehmen', async ({ page }) => {
  const gh = await fakeGitHub(page);
  await createProject(page, 'Stand 1');
  await rename(page, 'Stand 1 bearbeitet');
  const dlg = await connect(page);
  await expect(dlg).toContainText(`Repo ${REPO} erreichbar`);
  await expect(dlg).toContainText(`Ordner ${APP}/ wird beim ersten Speichern angelegt`);
  await expect(dlg.locator('.mcs-upload .mcs-doc', { hasText: 'Stand 1 bearbeitet' }).locator('input')).toBeChecked();
  await dlg.locator('[data-sync="finish"]').click();
  await expect(dlg).toBeHidden();

  const id = await idOf(page, 'Stand 1 bearbeitet');
  await expect.poll(() => gh.read(fileOf(id))?.data.name).toBe('Stand 1 bearbeitet');
  expect(gh.read(fileOf(id))).toMatchObject({ app: APP, schemaVersion: 1, device: expect.any(String) });
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');

  await rename(page, 'Stand 2');
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', /pending|busy/);
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await expect.poll(() => gh.read(fileOf(id))?.data.name).toBe('Stand 2');

  const rec = gh.read(fileOf(id));
  gh.write(fileOf(id), { ...rec, savedAt: rec.savedAt + 1000, device: 'Laptop', data: { ...rec.data, name: 'Vom Laptop' } });
  await nudge(page);
  await expect(page.locator('#projectName')).toContainText('Vom Laptop');
});

test('Unveränderte Beispiele sind beim Einrichten nicht vorausgewählt', async ({ page }) => {
  await fakeGitHub(page);
  await openExample(page);
  const dlg = await connect(page);
  await expect(dlg.locator('.mcs-upload input[type="checkbox"]')).not.toBeChecked();
  await expect(dlg.locator('[data-sync="finish"]')).toHaveText('Fertig');
});

test('Konflikt: „Beide behalten“ legt eine Kopie an', async ({ page }) => {
  const gh = await fakeGitHub(page);
  await createProject(page, 'Neu');
  await rename(page, 'Gemeinsam');
  await (await connect(page)).locator('[data-sync="finish"]').click();
  const id = await idOf(page, 'Gemeinsam');
  await expect.poll(() => gh.read(fileOf(id))?.data.name).toBe('Gemeinsam');

  // erst hier ändern und speichern, dann auf dem anderen Gerät – jeder Abgleich danach sieht beides
  await rename(page, 'Browser-Stand');
  await expect.poll(async () => (await storedProjects(page)).map(m => m.name)).toContain('Browser-Stand');
  const rec = gh.read(fileOf(id));
  gh.write(fileOf(id), { ...rec, savedAt: rec.savedAt + 1000, device: 'Laptop', data: { ...rec.data, name: 'Laptop-Stand' } });
  await nudge(page);
  const chip = page.locator('#syncStatus');
  await expect(chip).toHaveAttribute('data-status', 'conflict');
  await chip.click();
  const dlg = page.locator('#syncDialog');
  await expect(dlg).toContainText('„Browser-Stand“ wurde auch auf einem anderen Gerät geändert');
  await dlg.locator('[data-sync="both"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#projectName')).toContainText('Laptop-Stand (Laptop)');
  await expect.poll(() => gh.read(fileOf(id))?.data.name).toBe('Browser-Stand');
  await expect(chip).toHaveAttribute('data-status', 'ok');
});

test('Startseite: Zustand je Matrix, „Nur in der Ablage“ öffnen, Löschen, Trennen', async ({ page }) => {
  const example = JSON.parse(fs.readFileSync(new URL('../../examples/food-truck.de.json', import.meta.url), 'utf8'));
  const gh = await fakeGitHub(page, {
    files: { [fileOf('vom-laptop')]: { app: APP, schemaVersion: 1, savedAt: Date.parse('2026-10-14T16:05:00Z'), device: 'Laptop', data: { ...example, id: 'vom-laptop' } } },
  });
  await createProject(page, 'Neu');
  await rename(page, 'Hier');
  await (await connect(page)).locator('[data-sync="finish"]').click();
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');

  await page.click('#homeLink');
  const id = await idOf(page, 'Hier');
  await expect(page.locator(`[data-project="${id}"] [data-doc-state]`)).toHaveAttribute('data-doc-state', 'ok');
  const remote = page.locator('.mcs-remote .mcs-doc');
  await expect(remote).toContainText(example.name);
  await expect(remote).toContainText('Laptop');
  await remote.locator('[data-sync="download"]').click();
  await expect(page.locator('#projectName')).toContainText(example.name);

  // Gelöschte Matrix verschwindet auch aus der Ablage
  await page.click('#homeLink');
  await page.locator('[data-delete="vom-laptop"]').click();
  await page.click('#confirmOk');
  await nudge(page);
  await expect.poll(() => gh.files.has(fileOf('vom-laptop'))).toBe(false);

  // Trennen: Token und Einstellungen weg, Matrizen bleiben
  await menu(page, 'storage');
  page.once('dialog', d => d.accept());
  await page.locator('#syncDialog [data-sync="disconnect"]').click();
  await expect(page.locator('#syncStatus')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('method-commons:sync:token'), localStorage.getItem('method-commons:sync:config')])).toEqual([null, null]);
  expect(await idOf(page, 'Hier')).toBeTruthy();
});
