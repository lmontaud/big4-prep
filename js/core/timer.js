/* Big4 Prep — chronomètres fiables.
   Tout repose sur l'heure réelle (Date.now) : un chronomètre ne « compte » pas des ticks,
   il compare l'heure de départ à l'heure actuelle. Il continue donc pendant que l'app est
   en arrière-plan ou que l'écran est verrouillé, et un rafraîchissement d'écran raté ne fausse rien.
   Toutes les fonctions reçoivent l'heure en paramètre : testable avec une horloge simulée. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  /** Compte à rebours : { start, duration } (ms). */
  function countdown(startMs, durationMs) {
    return { start: startMs, duration: durationMs };
  }

  /** Temps écoulé (jamais négatif, même si l'horloge du téléphone a reculé). */
  function elapsed(t, nowMs) {
    return Math.max(0, Math.min(nowMs - t.start, t.duration == null ? Infinity : t.duration));
  }

  function remaining(t, nowMs) {
    return Math.max(0, t.start + t.duration - Math.max(nowMs, t.start));
  }

  function expired(t, nowMs) { return remaining(t, nowMs) <= 0; }

  /**
   * Chronomètre de question : durée passée sur une question.
   * Plafonnée (par défaut à 10 min) pour qu'une question laissée ouverte toute la nuit
   * ne fausse ni les statistiques de vitesse ni le temps d'entraînement du jour.
   */
  function questionTime(startMs, nowMs, capMs) {
    var d = Math.max(0, nowMs - startMs);
    return Math.min(d, capMs || 10 * 60 * 1000);
  }

  /** mm:ss */
  function format(ms) {
    var s = Math.ceil(Math.max(0, ms) / 1000), m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  BP.timer = { countdown: countdown, elapsed: elapsed, remaining: remaining, expired: expired, questionTime: questionTime, format: format };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.timer;
})(typeof self !== 'undefined' ? self : globalThis);
