import { test, expect, openExample } from './fixtures.js';

/*
 * Mehrere Browser-Tabs: Speichert ein Tab, übernimmt ein anderer mit demselben Dokument den Stand.
 * Gespeichert wird `{ savedAt, data }` – der andere Tab muss die Hülle über die Speicherschicht lesen.
 */
test('Änderung in einem anderen Browser-Tab wird übernommen', async ({ page }) => {
  await openExample(page);
  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(other.locator('#projectName')).toBeVisible();
  // im ersten Tab speichern, wie es die App tut (anderer Name, neuer Zeitpunkt)
  await page.evaluate(prefix => {
    const key = Object.keys(localStorage).find(k => k.startsWith(prefix));
    const rec = JSON.parse(localStorage.getItem(key));
    rec.data.name = 'Aus dem anderen Tab';
    rec.savedAt += 1;
    localStorage.setItem(key, JSON.stringify(rec));
  }, 'user-stories:project:');
  await expect(other.locator('#projectName')).toContainText('Aus dem anderen Tab');
  await other.close();
});
