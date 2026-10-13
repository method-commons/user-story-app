import { describe, expect, it } from 'vitest';
import { IO } from '../../js/io.js';
import { Model } from '../../js/model.js';
import { Ops } from '../../js/ops.js';

function project() {
  const p = Model.createProject({ name: 'Food-Truck', key: 'FT', description: 'Beschreibung *fett*' });
  const e = Model.createEpic({ name: 'Bestellen' });
  p.epics.push(e);
  const a = Ops.addStory(p, { role: 'Gast', want: 'bestellen', benefit: 'ich nicht warte', size: 'S', priority: 'must', epicId: e.id, notes: 'Notiz' });
  a.criteria.push(Model.createCriterion({ title: 'Grundfall', given: 'offen', when: 'ich bestelle', then: 'Nummer', confirmed: true }));
  a.criteria.push(Model.createCriterion({ format: 'check', text: 'Preis in €' }));
  a.conversation.push(Model.createEntry({ kind: 'decision', text: 'Max. 12', author: 'Aylin' }));
  a.conversation.push(Model.createEntry({ kind: 'question', text: 'Storno?' }));
  const b = Ops.addStory(p, { want: 'fertig', status: 'done' });
  Ops.addDependency(p, a.id, b.id);
  return p;
}

describe('JSON', () => {
  it('exportiert und liest ein Projekt verlustfrei', () => {
    const p = project();
    const back = IO.parse(IO.projectJson(p));
    expect(back).toEqual([p]);
  });

  it('liest Sicherungen und Listen', () => {
    const p = project();
    const backup = IO.backupJson([p, Model.createProject()], new Date('2026-01-01'));
    expect(JSON.parse(backup)).toMatchObject({ type: IO.BACKUP_TYPE, exportedAt: '2026-01-01T00:00:00.000Z' });
    expect(IO.parse(backup)).toHaveLength(2);
    expect(IO.parse(JSON.stringify([p]))).toHaveLength(1);
  });

  it('meldet Fehler', () => {
    expect(() => IO.parse('kein json')).toThrow('kein gültiges Projekt');
    expect(() => IO.parse('[]')).toThrow('keine Projekte');
    expect(() => IO.parse('42')).toThrow('kein gültiges Projekt');
  });
});

describe('Import zusammenführen', () => {
  it('neu, identisch oder Kopie', () => {
    const p = project();
    expect(IO.resolveImport(p, null)).toEqual({ action: 'new', project: p });
    expect(IO.resolveImport({ ...p, updatedAt: 'anders' }, p).action).toBe('same');
    const changed = { ...p, name: 'Anders' };
    const r = IO.resolveImport(changed, p);
    expect(r.action).toBe('copy');
    expect(r.project.id).not.toBe(p.id);
    expect(r.project.name).toBe('Anders (Import)');
  });
});

describe('Markdown', () => {
  it('enthält Stories, Kriterien und Conversation', () => {
    const md = IO.markdown(project());
    expect(md).toContain('# Food-Truck');
    expect(md).toContain('Beschreibung \\*fett\\*');
    expect(md).toContain('## Bestellen');
    expect(md).toContain('### FT-1 · Bestellen');
    expect(md).toContain('> Als Gast möchte ich bestellen, damit ich nicht warte.');
    expect(md).toContain('Status: Entwurf · Priorität: Must have · Größe: S · INVEST: I N V E? S T');
    expect(md).toContain('Abhängig von: FT-2');
    expect(md).toContain('- [x] AK 1 · Grundfall: **Gegeben** offen **Wenn** ich bestelle **Dann** Nummer');
    expect(md).toContain('- [ ] AK 2: Preis in €');
    expect(md).toContain('- Entscheidung: Max. 12 (Aylin)');
    expect(md).toContain('- Frage: Storno?');
    expect(md).toContain('## Ohne Epic');
    expect(md).toContain('~~V~~');
  });

  it('lässt Fertige auf Wunsch weg', () => {
    const md = IO.markdown(project(), { includeDone: false });
    expect(md).not.toContain('### FT-2');
    expect(IO.markdown(Model.createProject({ name: 'Leer' }))).toContain('Keine Stories.');
  });
});
