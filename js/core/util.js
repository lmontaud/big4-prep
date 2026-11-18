/* Big4 Prep — utilitaires (dates locales, hasard reproductible).
   Logique pure : fonctionne dans le navigateur et sous Node (tests). */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /** Clé de jour locale 'AAAA-MM-JJ' à partir d'une Date ou d'un timestamp. */
  function dayKey(d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function keyToUTC(key) {
    var p = String(key).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  /** Ajoute n jours à une clé de jour (insensible aux changements d'heure). */
  function addDays(key, n) {
    var d = new Date(keyToUTC(key) + n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  /** Nombre de jours entre deux clés (b - a). */
  function diffDays(a, b) {
    return Math.round((keyToUTC(b) - keyToUTC(a)) / 86400000);
  }

  /** Générateur pseudo-aléatoire reproductible (pour les tests). */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /** Arrondi décimal fiable (évite 1.005 -> 1.00). */
  function round(v, dec) {
    var f = Math.pow(10, dec || 0);
    return Math.round((v + (v >= 0 ? 1 : -1) * 1e-9) * f) / f;
  }

  /**
   * Format d'un nombre selon la langue de la question.
   * fr : 1 234,5 (espace fine insécable, virgule) ; en : 1,234.5
   */
  function fmtNum(v, lang, dec) {
    dec = dec == null ? 0 : dec;
    var neg = v < 0;
    var s = Math.abs(round(v, dec)).toFixed(dec);
    var parts = s.split('.');
    var sep = lang === 'en' ? ',' : '\u202F';
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    var out = parts.join(lang === 'en' ? '.' : ',');
    return (neg && Number(s) !== 0 ? '\u2212' : '') + out;
  }

  /** Entier aléatoire dans [lo, hi] (pas facultatif). */
  function randInt(rng, lo, hi, step) {
    step = step || 1;
    var n = Math.floor((hi - lo) / step) + 1;
    return lo + Math.floor(rng() * n) * step;
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  BP.util = {
    dayKey: dayKey, addDays: addDays, diffDays: diffDays,
    mulberry32: mulberry32, shuffle: shuffle, clamp: clamp, pad: pad,
    round: round, fmtNum: fmtNum, randInt: randInt, pick: pick
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.util;
})(typeof self !== 'undefined' ? self : globalThis);
