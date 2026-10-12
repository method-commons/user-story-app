/*
 * Util – kleine Hilfsfunktionen ohne DOM.
 */
export const Util = (() => {
  /** Zufällige, kurze ID. @param {string} [prefix] */
  function uid(prefix = '') {
    return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  /** Heutiges Datum als ISO-Tag (YYYY-MM-DD). @param {Date} [d] */
  function today(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  /** Zeitstempel (ISO). @param {Date} [d] */
  function now(d = new Date()) {
    return d.toISOString();
  }

  /** Text vereinheitlichen für die Suche: klein, ohne Akzente. @param {string} s */
  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Kürzel aus einem Projektnamen („Food-Truck Bestell-App“ → „FTB“). @param {string} name */
  function keyFromName(name) {
    const words = String(name || '').split(/[\s\-_/]+/).filter(w => /[a-z0-9äöüß]/i.test(w));
    let key = words.slice(0, 3).map(w => w.replace(/[^a-z0-9äöüß]/gi, '')[0] || '').join('');
    if (key.length < 2 && words[0]) key = words[0].replace(/[^a-z0-9äöüß]/gi, '').slice(0, 3);
    return sanitizeKey(key) || 'US';
  }

  /** Kürzel: nur Buchstaben/Ziffern, groß, höchstens 6 Zeichen. @param {string} key */
  function sanitizeKey(key) {
    return String(key || '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
      .replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  /** Dateiname aus einem Titel. @param {string} name @param {string} ext */
  function fileName(name, ext) {
    const base = fold(name).replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return (base || 'projekt') + '.' + ext;
  }

  /** Platzhalter `{name}` in einem Text ersetzen. @param {string} text @param {Record<string, string | number>} [params] */
  function fill(text, params = {}) {
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
  }

  /** Wörter zählen. @param {string} s */
  function words(s) {
    return String(s || '').trim().split(/\s+/).filter(Boolean).length;
  }

  return { uid, today, now, fold, keyFromName, sanitizeKey, fileName, fill, words };
})();
