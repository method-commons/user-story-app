import { describe, expect, it } from 'vitest';
import { Examples } from '../../js/examples.js';
import { Invest } from '../../js/invest.js';
import { Model } from '../../js/model.js';
import { Ops } from '../../js/ops.js';

describe('Beispiele', () => {
  for (const lang of ['de', 'en']) {
    it(`Food-Truck (${lang}) entspricht dem normalisierten Format`, () => {
      const raw = Examples.raw[lang];
      expect(Model.normalize(raw)).toEqual(raw);
    });
  }

  it('beide Sprachen haben dieselbe Struktur', () => {
    const strip = p => ({ ...p, stories: p.stories.map(s => ({ id: s.id, status: s.status, size: s.size, deps: s.dependsOn, ac: s.criteria.length, k: s.conversation.length })) });
    const { de, en } = Examples.raw;
    expect(strip(en).stories).toEqual(strip(de).stories);
  });

  it('zeigt typische INVEST-Hinweise', () => {
    const p = Examples.load('de');
    const st = Ops.stats(p);
    expect(st.count).toBe(10);
    expect(st.tooBig).toBe(1);
    expect(st.noBenefit).toBe(1);
    const db = p.stories.find(s => s.want.includes('PostgreSQL'));
    expect(Invest.check(p, db).N.state).toBe('warn');
  });

  it('lädt als neues Projekt in der Sprache der App', () => {
    const a = Examples.load();
    const b = Examples.load('fr');
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('Food-Truck Bestell-App');
    expect(b.name).toBe(a.name);
    expect(Examples.load('en').name).toBe('Food truck ordering app');
  });
});
