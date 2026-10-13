import { describe, expect, it } from 'vitest';
import { Model } from '../../js/model.js';
import { Ops } from '../../js/ops.js';

function project() {
  const p = Model.createProject({ key: 'FT' });
  const a = Ops.addStory(p, { want: 'a', role: 'Gast', benefit: 'x' });
  const b = Ops.addStory(p, { want: 'b' });
  const c = Ops.addStory(p, { want: 'c' });
  return { p, a, b, c };
}
const order = p => p.stories.map(s => s.want).join('');

describe('Stories anlegen, löschen, kopieren', () => {
  it('vergibt fortlaufende Nummern und Position', () => {
    const { p } = project();
    expect(p.stories.map(s => s.number)).toEqual([1, 2, 3]);
    Ops.addStory(p, { want: 'z' }, 0);
    expect(order(p)).toBe('zabc');
    Ops.addStory(p, { want: 'y' }, 99);
    expect(order(p)).toBe('zabcy');
    expect(p.nextNumber).toBe(6);
  });

  it('löscht und entfernt Verweise', () => {
    const { p, a, b } = project();
    Ops.addDependency(p, a.id, b.id);
    expect(Ops.deleteStory(p, b.id)).toBe(true);
    expect(a.dependsOn).toEqual([]);
    expect(Ops.deleteStory(p, 'nix')).toBe(false);
  });

  it('kopiert ohne Bestätigungen', () => {
    const { p, a } = project();
    a.title = 'Titel';
    a.status = 'done';
    a.invest = { I: true };
    a.criteria.push(Model.createCriterion({ confirmed: true }));
    a.conversation.push(Model.createEntry({ criterionId: a.criteria[0].id }));
    const copy = Ops.duplicateStory(p, a.id);
    expect(copy).toMatchObject({ number: 4, status: 'draft', title: 'Titel (Kopie)', invest: {} });
    expect(copy.criteria[0].confirmed).toBe(false);
    expect(copy.criteria[0].id).not.toBe(a.criteria[0].id);
    expect(copy.conversation[0].criterionId).toBeNull();
    expect(p.stories[1]).toBe(copy);
    expect(Ops.duplicateStory(p, 'nix')).toBeNull();
    a.title = '';
    expect(Ops.duplicateStory(p, a.id).title).toBe('');
  });
});

describe('Reihenfolge und Status', () => {
  it('verschiebt Stories', () => {
    const { p, a, c } = project();
    expect(Ops.moveStory(p, c.id, 0)).toBe(true);
    expect(order(p)).toBe('cab');
    expect(Ops.moveStory(p, a.id, 99)).toBe(true);
    expect(order(p)).toBe('cba');
    expect(Ops.moveStory(p, a.id, 2)).toBe(false);
    expect(Ops.moveStory(p, 'nix', 0)).toBe(false);
  });

  it('tauscht mit dem sichtbaren Nachbarn', () => {
    const { p, a, c } = project();
    const visible = [a, c];
    expect(Ops.stepStory(p, c.id, -1, visible)).toBe(true);
    expect(order(p)).toBe('cba');
    expect(Ops.stepStory(p, c.id, -1, [c, a])).toBe(false);
    expect(Ops.stepStory(p, 'nix', 1, visible)).toBe(false);
  });

  it('setzt den Status', () => {
    const { p, a } = project();
    expect(Ops.setStatus(p, a.id, 'ready')).toBe(true);
    expect(a.status).toBe('ready');
    expect(Ops.setStatus(p, a.id, 'ready')).toBe(false);
    expect(Ops.setStatus(p, a.id, /** @type {any} */ ('weg'))).toBe(false);
  });
});

describe('Abhängigkeiten', () => {
  it('verhindert Selbstbezug, Doppelte und Kreise', () => {
    const { p, a, b, c } = project();
    expect(Ops.addDependency(p, a.id, b.id)).toBe(true);
    expect(Ops.addDependency(p, a.id, b.id)).toBe(false);
    expect(Ops.addDependency(p, a.id, a.id)).toBe(false);
    expect(Ops.addDependency(p, b.id, c.id)).toBe(true);
    expect(Ops.addDependency(p, c.id, a.id)).toBe(false);
    expect(Ops.reaches(p, a.id, c.id)).toBe(true);
    expect(Ops.removeDependency(p, a.id, b.id)).toBe(true);
    expect(a.dependsOn).toEqual([]);
    expect(Ops.removeDependency(p, 'nix', b.id)).toBe(false);
  });
});

describe('Conversation und Kriterien', () => {
  it('übernimmt eine Entscheidung als Kriterium', () => {
    const { a } = project();
    const e = Model.createEntry({ kind: 'decision', text: 'Max. 12 je Fenster' });
    a.conversation.push(e);
    const c = Ops.criterionFromEntry(a, e.id);
    expect(c).toMatchObject({ format: 'check', text: 'Max. 12 je Fenster' });
    expect(e.criterionId).toBe(c.id);
    expect(Ops.criterionFromEntry(a, e.id)).toBeNull();
    Ops.deleteCriterion(a, c.id);
    expect(a.criteria).toEqual([]);
    expect(e.criterionId).toBeNull();
  });

  it('verschiebt Listeneinträge', () => {
    const list = [1, 2, 3];
    expect(Ops.step(list, 0, 1)).toBe(true);
    expect(list).toEqual([2, 1, 3]);
    expect(Ops.step(list, 0, -1)).toBe(false);
  });
});

describe('Aufteilen', () => {
  it('wandelt das Original in ein Epic um', () => {
    const { p, a, b } = project();
    a.priority = 'should';
    Ops.addDependency(p, b.id, a.id);
    const parts = [{ role: 'Gast', want: 'Teil 1', benefit: 'x', size: 'S' }, { role: 'Gast', want: ' ', benefit: '' }, { role: 'Gast', want: 'Teil 2', benefit: 'x' }];
    const created = Ops.splitStory(p, a.id, parts, true);
    expect(created).toHaveLength(2);
    expect(order(p)).toBe('Teil 1Teil 2bc');
    expect(p.epics).toHaveLength(1);
    expect(p.epics[0]).toMatchObject({ name: 'A', description: 'Als Gast möchte ich a, damit x.' });
    expect(created.every(s => s.epicId === p.epics[0].id && s.priority === 'should')).toBe(true);
    expect(created[0].size).toBe('S');
    expect(created[0].notes).toBe('Aufgeteilt aus FT-1.');
    expect(b.dependsOn).toEqual(created.map(s => s.id));
  });

  it('behält das Original', () => {
    const { p, a } = project();
    const created = Ops.splitStory(p, a.id, [{ role: '', want: 'n', benefit: '' }], false);
    expect(order(p)).toBe('anbc');
    expect(created[0].epicId).toBeNull();
    expect(Ops.splitStory(p, a.id, [{ role: '', want: '', benefit: '' }], false)).toEqual([]);
    expect(Ops.splitStory(p, 'nix', [{ role: '', want: 'x', benefit: '' }], false)).toEqual([]);
  });
});

describe('Epics und Skala', () => {
  it('löscht Epics ohne Stories zu verlieren', () => {
    const { p, a } = project();
    const e = Model.createEpic({ name: 'E' });
    p.epics.push(e);
    a.epicId = e.id;
    Ops.deleteEpic(p, e.id);
    expect(p.epics).toEqual([]);
    expect(a.epicId).toBeNull();
    expect(p.stories).toHaveLength(3);
  });

  it('überträgt Größen beim Skalenwechsel', () => {
    const { p, a, b, c } = project();
    a.size = 'XS'; b.size = 'XL'; c.size = '?';
    Ops.setSizeScale(p, 'points');
    expect([a.size, b.size, c.size]).toEqual(['1', '40', '?']);
    expect(p.settings.smallLimit).toBe('8');
    Ops.setSizeScale(p, 'points');
    Ops.setSizeScale(p, 'tshirt');
    expect([a.size, b.size]).toEqual(['XS', 'XL']);
  });
});

describe('Kennzahlen', () => {
  it('zählt Status, INVEST und Hinweise', () => {
    const { p, a, b, c } = project();
    a.size = 'S';
    a.criteria.push(Model.createCriterion({ format: 'check', text: 'ok' }));
    a.status = 'ready';
    a.dor[p.settings.dor[0].id] = true;
    b.status = 'progress';
    b.size = 'XL';
    c.conversation.push(Model.createEntry({ kind: 'question' }));
    const st = Ops.stats(p);
    expect(st.count).toBe(3);
    expect(st.byStatus).toMatchObject({ draft: 1, ready: 1, progress: 1 });
    expect(st.compliant).toBe(1);
    expect(st.compliantPct).toBe(33);
    expect(st.noBenefit).toBe(2);
    expect(st.tooBig).toBe(1);
    expect(st.readyNoCriteria).toBe(1);
    expect(st.openQuestions).toBe(1);
    expect(st.unestimated).toBe(1);
    expect(st.readyCount).toBe(1);
    expect(st.points).toBeNull();
    expect(st.letters.V).toBe(1);
    expect(Ops.stats(Model.createProject()).compliantPct).toBeNull();
  });
});
