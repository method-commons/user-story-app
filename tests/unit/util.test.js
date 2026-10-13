import { describe, expect, it } from 'vitest';
import { Util } from '../../js/util.js';

describe('Util', () => {
  it('erzeugt eindeutige IDs mit Präfix', () => {
    const a = Util.uid('s');
    expect(a).toMatch(/^s[a-z0-9]+$/);
    expect(Util.uid('s')).not.toBe(a);
  });

  it('liefert Datum und Zeitstempel', () => {
    const d = new Date('2026-03-04T05:06:07Z');
    expect(Util.today(d)).toBe('2026-03-04');
    expect(Util.now(d)).toBe('2026-03-04T05:06:07.000Z');
    expect(Util.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('faltet Text für die Suche', () => {
    expect(Util.fold('Crème Brûlée')).toBe('creme brulee');
    expect(Util.fold(null)).toBe('');
  });

  it('bildet Kürzel aus Namen', () => {
    expect(Util.keyFromName('Food-Truck Bestell-App')).toBe('FTB');
    expect(Util.keyFromName('Vereinsportal')).toBe('VER');
    expect(Util.keyFromName('Über uns')).toBe('UEU');
    expect(Util.keyFromName('')).toBe('US');
    expect(Util.keyFromName('!!!')).toBe('US');
  });

  it('bereinigt Kürzel', () => {
    expect(Util.sanitizeKey('ab-cd ef12')).toBe('ABCDEF');
    expect(Util.sanitizeKey('öß')).toBe('OESS');
    expect(Util.sanitizeKey(null)).toBe('');
  });

  it('erzeugt Dateinamen', () => {
    expect(Util.fileName('Food-Truck Bestell-App', 'json')).toBe('food-truck-bestell-app.json');
    expect(Util.fileName('Straße', 'md')).toBe('strasse.md');
    expect(Util.fileName('???', 'md')).toBe('projekt.md');
  });

  it('ersetzt Platzhalter und zählt Wörter', () => {
    expect(Util.fill('{n} von {total}', { n: 2, total: 5 })).toBe('2 von 5');
    expect(Util.fill('{x}')).toBe('{x}');
    expect(Util.words('  ein zwei  drei ')).toBe(3);
    expect(Util.words('')).toBe(0);
  });
});
