import { describe, expect, it } from 'vitest';
import { Invest } from '../../js/invest.js';
import { Model } from '../../js/model.js';

/** Projekt mit einer gut formulierten Story. */
function setup(fields = {}) {
  const p = Model.createProject({ key: 'FT' });
  const s = Model.createStory({
    number: 1, role: 'hungriger Gast', want: 'vorab per Handy bestellen', benefit: 'ich nicht warte', size: 'S',
    criteria: [Model.createCriterion({ given: 'Truck offen', when: 'ich bestelle', then: 'bekomme ich eine Nummer' })],
    ...fields,
  });
  p.stories.push(s);
  return { p, s };
}

describe('Invest.auto', () => {
  it('erfüllt alle sechs bei guter Story', () => {
    const { p, s } = setup();
    expect(Invest.score(p, s)).toBe(6);
    expect(Invest.compliant(p, s)).toBe(true);
    expect(Invest.hasProblem(p, s)).toBe(false);
  });

  it('Independent: offene Abhängigkeiten', () => {
    const { p, s } = setup();
    const dep = Model.createStory({ number: 2 });
    p.stories.push(dep);
    s.dependsOn = [dep.id];
    expect(Invest.auto(p, s).I).toMatchObject({ auto: 'warn', hint: 'depends', params: { list: 'FT-2', n: 1 } });
    dep.status = 'done';
    expect(Invest.auto(p, s).I.auto).toBe('ok');
  });

  it('Negotiable: technische Begriffe', () => {
    const { p, s } = setup({ want: 'eine PostgreSQL-Datenbank und eine REST API' });
    const r = Invest.auto(p, s).N;
    expect(r.auto).toBe('warn');
    expect(r.params.list).toBe('datenbank, postgresql, api, rest');
    expect(Invest.auto(p, { ...s, want: '' }).N.auto).toBe('none');
    expect(Invest.auto(p, { ...s, want: 'die Kundendatenbank durchsuchen' }).N.params.list).toBe('datenbank');
    expect(Invest.auto(p, { ...s, want: 'Rapido bestellen' }).N.auto).toBe('ok');
  });

  it('Valuable: Nutzen und Rolle', () => {
    const { p, s } = setup();
    expect(Invest.auto(p, { ...s, benefit: '' }).V.auto).toBe('bad');
    expect(Invest.auto(p, { ...s, role: '' }).V.hint).toBe('noRole');
    expect(Invest.auto(p, { ...s, role: 'ein Nutzer' }).V).toMatchObject({ auto: 'warn', hint: 'genericRole' });
    expect(Invest.auto(p, { ...s, role: 'User' }).V.hint).toBe('genericRole');
  });

  it('Estimable: Schätzung und offene Fragen', () => {
    const { p, s } = setup();
    expect(Invest.auto(p, { ...s, size: null }).E.hint).toBe('notEstimated');
    expect(Invest.auto(p, { ...s, size: '?' }).E.hint).toBe('unestimable');
    const q = Model.createEntry({ kind: 'question', text: '?' });
    expect(Invest.auto(p, { ...s, conversation: [q] }).E).toMatchObject({ auto: 'warn', params: { n: 1 } });
    expect(Invest.auto(p, { ...s, conversation: [{ ...q, resolved: true }] }).E.auto).toBe('ok');
  });

  it('Small: Grenze und mehrere Teile', () => {
    const { p, s } = setup();
    expect(Invest.auto(p, { ...s, size: 'L' }).S).toMatchObject({ auto: 'bad', params: { size: 'L', limit: 'M' } });
    expect(Invest.auto(p, { ...s, size: 'M' }).S.auto).toBe('ok');
    expect(Invest.auto(p, { ...s, size: null }).S.auto).toBe('none');
    expect(Invest.auto(p, { ...s, size: '?' }).S.auto).toBe('none');
    expect(Invest.auto(p, { ...s, want: 'Statistik, Lager und Personal und Kasse' }).S).toMatchObject({ auto: 'warn', hint: 'manyParts' });
  });

  it('Testable: Kriterien vollständig und messbar', () => {
    const { p, s } = setup();
    expect(Invest.auto(p, { ...s, criteria: [] }).T.auto).toBe('bad');
    expect(Invest.auto(p, { ...s, criteria: [Model.createCriterion({ given: 'a', when: 'b' })] }).T).toMatchObject({ auto: 'warn', hint: 'incomplete' });
    expect(Invest.auto(p, { ...s, criteria: [Model.createCriterion({ format: 'check', text: '' })] }).T.hint).toBe('incomplete');
    expect(Invest.auto(p, { ...s, criteria: [Model.createCriterion({ format: 'check', text: 'Die Seite lädt schnell' })] }).T)
      .toMatchObject({ auto: 'warn', hint: 'vague', params: { list: 'schnell' } });
  });
});

describe('Invest.check', () => {
  it('Bestätigung macht Hinweise zu erfüllt, aber nicht Verletzungen', () => {
    const { p, s } = setup({ want: 'eine Datenbank', benefit: '' });
    let r = Invest.check(p, s);
    expect(r.N.state).toBe('warn');
    expect(r.V.state).toBe('bad');
    s.invest = { N: true, V: true };
    r = Invest.check(p, s);
    expect(r.N).toMatchObject({ state: 'ok', confirmed: true });
    expect(r.V.state).toBe('bad');
    expect(Invest.score(p, s)).toBe(5);
  });

  it('ohne Aussage ist ungeprüft', () => {
    const { p, s } = setup({ size: null });
    expect(Invest.check(p, s).S.state).toBe('open');
  });
});

describe('Ready und Done', () => {
  it('prüft automatische und eigene Punkte', () => {
    const { p, s } = setup();
    const dorId = p.settings.dor[0].id;
    let ready = Invest.ready(p, s);
    expect(ready.map(x => x.id)).toEqual(['format', 'criteria', 'estimated', 'small', dorId]);
    expect(Invest.missing(ready).map(x => x.id)).toEqual([dorId]);
    s.dor[dorId] = true;
    expect(Invest.missing(Invest.ready(p, s))).toEqual([]);
    s.size = 'XL';
    expect(Invest.missing(Invest.ready(p, s)).map(x => x.id)).toEqual(['small']);

    let done = Invest.done(p, s);
    expect(Invest.missing(done).map(x => x.id)).toEqual(['confirmed', ...p.settings.dod.map(x => x.id)]);
    s.criteria[0].confirmed = true;
    for (const x of p.settings.dod) s.dod[x.id] = true;
    done = Invest.done(p, s);
    expect(Invest.missing(done)).toEqual([]);
  });

  it('kennt die Prüfungen je Statuswechsel', () => {
    expect(Invest.gatesFor('draft', 'ready')).toEqual(['ready']);
    expect(Invest.gatesFor('draft', 'progress')).toEqual(['ready']);
    expect(Invest.gatesFor('draft', 'done')).toEqual(['ready', 'done']);
    expect(Invest.gatesFor('review', 'done')).toEqual(['done']);
    expect(Invest.gatesFor('ready', 'progress')).toEqual([]);
    expect(Invest.gatesFor('done', 'draft')).toEqual([]);
  });

  it('Kriterien vollständig', () => {
    expect(Invest.criterionComplete(Model.createCriterion({ format: 'check', text: 'x' }))).toBe(true);
    expect(Invest.criterionComplete(Model.createCriterion({ given: 'a', when: 'b', then: ' ' }))).toBe(false);
  });
});
