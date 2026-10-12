import { describe, expect, it } from 'vitest';
import { Model } from '../../js/model.js';

describe('Model.createProject', () => {
  it('legt ein vollständiges Projekt mit Vorgaben an', () => {
    const p = Model.createProject({ name: 'Food-Truck Bestell-App', sizeScale: 'points' });
    expect(p.key).toBe('FTB');
    expect(p.version).toBe(Model.SCHEMA_VERSION);
    expect(p.settings.sizeScale).toBe('points');
    expect(p.settings.smallLimit).toBe('8');
    expect(p.settings.dor.map(x => x.text)).toEqual(['Mit dem Product Owner besprochen']);
    expect(p.settings.dod).toHaveLength(2);
    expect(p.nextNumber).toBe(1);
    expect(p.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('nutzt Platzhalter, eigenes Kürzel und T-Shirt-Größen als Standard', () => {
    const p = Model.createProject({ key: 'ab', color: '#ABCDEF' });
    expect(p.name).toBe('Neues Projekt');
    expect(p.key).toBe('AB');
    expect(p.color).toBe('#abcdef');
    expect(p.settings.sizeScale).toBe('tshirt');
    expect(p.settings.smallLimit).toBe('M');
  });
});

describe('Model.normalize', () => {
  it('lehnt Ungültiges und neuere Versionen ab', () => {
    expect(() => Model.normalize(null)).toThrow('kein gültiges Projekt');
    expect(() => Model.normalize([])).toThrow();
    expect(() => Model.normalize({ version: 99 })).toThrow('neueren Version');
  });

  it('ergänzt fehlende Felder', () => {
    const p = Model.normalize({ name: 'X', stories: [{ want: 'etwas' }] });
    expect(p.name).toBe('X');
    expect(p.stories[0]).toMatchObject({ number: 1, want: 'etwas', status: 'draft', size: null, priority: null, criteria: [], conversation: [] });
    expect(p.nextNumber).toBe(2);
    expect(p.settings.dor).toHaveLength(1);
  });

  it('prüft Werte, Verweise und doppelte IDs', () => {
    const p = Model.normalize({
      id: 'p1', name: 'P', key: 'pp', color: 'rot', nextNumber: 1,
      settings: { sizeScale: 'tshirt', smallLimit: 'xxl', dor: [{ id: 'd1', text: 'A' }, { id: 'd1', text: 'B' }, 'x'], dod: [] },
      epics: [{ id: 'e1', name: 'E', color: '#123456' }, { id: 'e1' }, null],
      stories: [
        {
          id: 's1', number: 3, want: 'a', size: 'm', priority: 'must', epicId: 'e1', status: 'review', dependsOn: ['s2', 's1', 's2', 'zz', 5],
          invest: { I: true, N: 'ja', X: true }, dor: { d1: true, unbekannt: true }, dod: { x: true },
          criteria: [{ id: 'a1', format: 'check', text: 'T', confirmed: true }, { id: 'a1', given: 'g' }, 7],
          conversation: [{ id: 'k1', kind: 'decision', text: 'D', criterionId: 'a1', date: '2026-01-02', resolved: true }, { id: 'k1', kind: 'quatsch', criterionId: 'nix', date: 'gestern' }],
          createdAt: 'kein Datum',
        },
        { id: 's1', number: 3, want: 'b', size: '13', priority: 'egal', epicId: 'weg', status: 'fertig' },
        { id: 's2', number: -1, size: '?' },
      ],
    });
    expect(p.key).toBe('PP');
    expect(p.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(p.settings.smallLimit).toBe('M');
    expect(p.settings.dor.map(x => x.text)).toEqual(['A', 'B']);
    expect(new Set(p.settings.dor.map(x => x.id)).size).toBe(2);
    expect(p.epics).toHaveLength(2);
    expect(p.epics[0].id).not.toBe(p.epics[1].id);
    const [a, b, c] = p.stories;
    expect(a.size).toBe('M');
    expect(a.priority).toBe('must');
    expect(a.status).toBe('review');
    expect(a.dependsOn).toEqual(['s2']);
    expect(a.invest).toEqual({ I: true });
    expect(a.dor).toEqual({ d1: true });
    expect(a.dod).toEqual({});
    expect(a.criteria).toHaveLength(2);
    expect(a.criteria[0]).toMatchObject({ format: 'check', text: 'T', confirmed: true });
    expect(a.criteria[1].id).not.toBe('a1');
    expect(a.conversation[0]).toMatchObject({ kind: 'decision', criterionId: 'a1', date: '2026-01-02', resolved: true });
    expect(a.conversation[1]).toMatchObject({ kind: 'note', criterionId: null });
    expect(a.conversation[1].id).not.toBe('k1');
    expect(Number.isNaN(Date.parse(a.createdAt))).toBe(false);
    expect(b.id).not.toBe('s1');
    expect(b.number).toBe(4);
    expect(b.size).toBeNull();
    expect(b.priority).toBeNull();
    expect(b.epicId).toBeNull();
    expect(b.status).toBe('draft');
    expect(c.number).toBe(5);
    expect(c.size).toBe('?');
    expect(p.nextNumber).toBe(6);
  });

  it('behält eine gültige nächste Nummer', () => {
    const p = Model.normalize({ nextNumber: 10, stories: [{ number: 2 }] });
    expect(p.nextNumber).toBe(10);
  });

  it('übernimmt Story Points', () => {
    const p = Model.normalize({ settings: { sizeScale: 'points', smallLimit: '5' }, stories: [{ size: 8 }, { size: '7' }] });
    expect(p.settings.smallLimit).toBe('5');
    expect(p.stories.map(s => s.size)).toEqual(['8', null]);
  });
});

describe('Standardformat', () => {
  const s = Model.createStory({ role: 'hungriger Gast', want: 'vorab bestellen', benefit: 'ich nicht warte.' });

  it('setzt den Satz zusammen', () => {
    expect(Model.sentence(s)).toBe('Als hungriger Gast möchte ich vorab bestellen, damit ich nicht warte.');
    expect(Model.sentence(Model.createStory({ want: 'x' }))).toBe('möchte ich x.');
    expect(Model.sentence(Model.createStory({ benefit: 'y' }))).toBe('damit y.');
    expect(Model.sentence(Model.createStory())).toBe('');
  });

  it('liefert Titel und Code', () => {
    const p = Model.createProject({ key: 'FT' });
    expect(Model.title(s)).toBe('Vorab bestellen');
    expect(Model.title({ ...s, title: 'Kurz' })).toBe('Kurz');
    expect(Model.title(Model.createStory())).toBe('(neue Story)');
    expect(Model.code(p, { ...s, number: 7 })).toBe('FT-7');
  });

  it('zerlegt deutsche Sätze', () => {
    expect(Model.parseSentence('Als hungriger Gast möchte ich vorab bestellen, damit ich nicht warte.'))
      .toEqual({ role: 'hungriger Gast', want: 'vorab bestellen', benefit: 'ich nicht warte' });
    expect(Model.parseSentence('Als eine Köchin will ich Bestellungen sehen um nichts zu vergessen'))
      .toEqual({ role: 'Köchin', want: 'Bestellungen sehen', benefit: 'nichts zu vergessen' });
    expect(Model.parseSentence('als Gast möchte ich bezahlen')).toEqual({ role: 'Gast', want: 'bezahlen', benefit: '' });
  });

  it('zerlegt englische Sätze', () => {
    expect(Model.parseSentence('As a hungry guest, I want to order ahead so that I don’t queue'))
      .toEqual({ role: 'a hungry guest', want: 'order ahead', benefit: 'I don’t queue' });
    expect(Model.parseSentence('As the owner I would like reports so I can plan'))
      .toEqual({ role: 'the owner', want: 'reports', benefit: 'I can plan' });
  });

  it('übernimmt freien Text als Ziel', () => {
    expect(Model.parseSentence('  Speisekarte anzeigen. ')).toEqual({ role: '', want: 'Speisekarte anzeigen', benefit: '' });
    expect(Model.parseSentence(null)).toEqual({ role: '', want: '', benefit: '' });
  });
});

describe('Größen', () => {
  it('liefert Skala und Punktsumme', () => {
    const p = Model.createProject({ sizeScale: 'points' });
    p.stories = [Model.createStory({ size: '5' }), Model.createStory({ size: '?' }), Model.createStory({ size: '3' }), Model.createStory()];
    expect(Model.sizes(p)).toContain('13');
    expect(Model.pointSum(p)).toBe(8);
    expect(Model.pointSum(Model.createProject())).toBeNull();
    expect(Model.normalizeSize('', 'tshirt')).toBeNull();
  });

  it('legt Kriterien, Einträge und Epics an', () => {
    expect(Model.createCriterion({ format: 'check' })).toMatchObject({ format: 'check', confirmed: false });
    expect(Model.createEntry({ kind: 'question' })).toMatchObject({ kind: 'question', resolved: false, criterionId: null });
    expect(Model.createEpic({ name: 'E' }).name).toBe('E');
  });
});
