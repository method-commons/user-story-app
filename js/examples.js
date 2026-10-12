/*
 * Examples – mitgelieferte Beispielprojekte (je Sprache eine Datei unter examples/).
 * Exportiert den Namensraum `Examples`.
 */
import foodTruckDe from '../examples/food-truck.de.json';
import foodTruckEn from '../examples/food-truck.en.json';
import { Languages } from './texts.js';
import { Model } from './model.js';
import { Util } from './util.js';

export const Examples = (() => {
  /** @type {Record<string, any>} */
  const FOOD_TRUCK = { de: foodTruckDe, en: foodTruckEn };

  /**
   * Beispiel in der Sprache der App als neues Projekt (neue ID, aktuelle Zeitstempel).
   * @param {string} [lang] @returns {Project}
   */
  function load(lang = Languages.detect()) {
    const p = Model.normalize(FOOD_TRUCK[lang] || FOOD_TRUCK.de);
    const stamp = Util.now();
    p.id = Util.uid('p');
    p.createdAt = stamp;
    p.updatedAt = stamp;
    return p;
  }

  /** Rohdaten (für Tests). */
  const raw = FOOD_TRUCK;

  return { load, raw };
})();
