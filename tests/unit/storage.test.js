import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Model } from '../../js/model.js';
import { Store } from '../../js/storage.js';

/** Einfacher localStorage-Ersatz für Node. */
function fakeStorage() {
  const data = new Map();
  const api = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); },
  };
  return new Proxy(api, {
    ownKeys: () => [...data.keys()],
    getOwnPropertyDescriptor: (t, k) => (data.has(k) ? { enumerable: true, configurable: true, value: data.get(k) } : undefined),
  });
}

describe('Store', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', fakeStorage()); });

  it('speichert, lädt, listet und löscht Projekte', () => {
    const a = Model.createProject({ name: 'A' });
    const b = Model.createProject({ name: 'B' });
    b.updatedAt = '2099-01-01T00:00:00.000Z';
    expect(Store.save(a)).toBe(true);
    Store.save(b);
    localStorage.setItem('anderes', 'x');
    localStorage.setItem(Store.PREFIX + 'kaputt', '{nicht json');
    expect(Store.load(a.id)).toEqual(a);
    expect(Store.load('fehlt')).toBeNull();
    expect(Store.load('kaputt')).toBeNull();
    expect(Store.all().map(p => p.name)).toEqual(['B', 'A']);
    Store.removeDoc(a.id);
    expect(Store.all().map(p => p.name)).toEqual(['B']);
  });

  it('erkennt Projekt-Schlüssel', () => {
    expect(Store.docIdFromKey(Store.PREFIX + 'abc')).toBe('abc');
    expect(Store.docIdFromKey('x')).toBeNull();
    expect(Store.docIdFromKey(null)).toBeNull();
  });

  it('merkt Einstellungen', () => {
    expect(Store.loadPrefs()).toEqual(Store.DEFAULT_PREFS);
    Store.savePrefs({ author: 'Lena', group: 'status' });
    expect(Store.loadPrefs()).toEqual({ author: 'Lena', group: 'status' });
    localStorage.setItem('user-stories:prefs', '{"author":5,"group":"x"}');
    expect(Store.loadPrefs()).toEqual({ author: '', group: 'epic' });
    localStorage.setItem('user-stories:prefs', 'kaputt');
    expect(Store.loadPrefs()).toEqual(Store.DEFAULT_PREFS);
  });

  it('übersteht fehlenden Speicher', () => {
    vi.stubGlobal('localStorage', undefined);
    const p = Model.createProject();
    expect(Store.save(p)).toBe(false);
    expect(Store.load(p.id)).toBeNull();
    expect(Store.all()).toEqual([]);
    Store.removeDoc(p.id);
    expect(Store.loadPrefs()).toEqual(Store.DEFAULT_PREFS);
  });

  it('speichert { savedAt, data } und liest ältere Einträge ohne Hülle', () => {
    const neu = Model.createProject({ name: 'Neu' });
    expect(Store.writeDoc(neu.id, neu, 1000)).toBe(true);
    expect(JSON.parse(localStorage.getItem(Store.PREFIX + neu.id))).toEqual({ savedAt: 1000, data: neu });
    expect(Store.readDoc(neu.id)).toEqual({ id: neu.id, savedAt: 1000, data: neu });
    const alt = Model.createProject({ name: 'Alt' });
    alt.updatedAt = '2026-03-01T00:00:00.000Z';
    localStorage.setItem(Store.PREFIX + alt.id, JSON.stringify(alt));
    expect(Store.readDoc(alt.id)).toEqual({ id: alt.id, savedAt: Date.parse(alt.updatedAt), data: alt });
    expect(Store.listDocs().map(d => d.data.name)).toEqual(['Alt', 'Neu']);
    expect(Store.docIdFromKey(Store.PREFIX + alt.id)).toBe(alt.id);
    Store.save(alt);
    expect(JSON.parse(localStorage.getItem(Store.PREFIX + alt.id)).data).toEqual(alt);
    Store.removeDoc(alt.id);
    expect(Store.readDoc(alt.id)).toBeNull();
  });
});
