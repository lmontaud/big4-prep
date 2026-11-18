/* Big4 Prep — moteur de la calculatrice intégrée (sans eval).
   Gère + − × ÷ ( ) %, le moins unaire, la virgule ou le point décimal.
   « 15 % » vaut 0,15 ; « 200 × 15 % » vaut 30. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  function tokenize(src) {
    var s = String(src).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/,/g, '.');
    var out = [], i = 0;
    while (i < s.length) {
      var ch = s.charAt(i);
      if (/[0-9.]/.test(ch)) {
        var j = i;
        while (j < s.length && /[0-9.]/.test(s.charAt(j))) j++;
        var num = s.slice(i, j);
        if ((num.match(/\./g) || []).length > 1 || num === '.') throw new Error('Nombre mal écrit');
        out.push({ t: 'n', v: parseFloat(num) });
        i = j;
      } else if ('+-*/()%'.indexOf(ch) !== -1) {
        out.push({ t: ch }); i++;
      } else throw new Error('Caractère non reconnu : ' + ch);
    }
    return out;
  }

  /** Analyse récursive : expr = terme (('+'|'-') terme)* ; terme = facteur (('*'|'/') facteur)* ; facteur = ('-')? primaire ('%')* */
  function evaluate(src) {
    var tk, pos = 0;
    try { tk = tokenize(src); } catch (e) { return { ok: false, error: e.message }; }
    if (!tk.length) return { ok: false, error: 'Expression vide' };
    function peek() { return tk[pos] && tk[pos].t; }
    function expr() {
      var v = term();
      while (peek() === '+' || peek() === '-') { var op = tk[pos++].t; var r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    function term() {
      var v = factor();
      while (peek() === '*' || peek() === '/') {
        var op = tk[pos++].t; var r = factor();
        if (op === '/') { if (r === 0) throw new Error('Division par zéro'); v = v / r; } else v = v * r;
      }
      return v;
    }
    function factor() {
      if (peek() === '-') { pos++; return -factor(); }
      if (peek() === '+') { pos++; return factor(); }
      var v = primary();
      while (peek() === '%') { pos++; v = v / 100; }
      return v;
    }
    function primary() {
      var t = tk[pos];
      if (!t) throw new Error('Expression incomplète');
      if (t.t === 'n') { pos++; return t.v; }
      if (t.t === '(') {
        pos++; var v = expr();
        if (peek() !== ')') throw new Error('Parenthèse non fermée');
        pos++; return v;
      }
      throw new Error('Expression incomplète');
    }
    try {
      var v = expr();
      if (pos < tk.length) throw new Error('Expression mal formée');
      if (!isFinite(v)) throw new Error('Résultat non défini');
      return { ok: true, value: Math.round(v * 1e10) / 1e10 };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /** Affichage du résultat à la française (virgule), sans zéros inutiles, 10 chiffres significatifs au plus. */
  function display(v) {
    if (!isFinite(v)) return 'Erreur';
    var s = Math.abs(v) >= 1e12 || (Math.abs(v) < 1e-6 && v !== 0) ? v.toExponential(6) : String(parseFloat(v.toPrecision(12)));
    return s.replace('.', ',').replace('-', '−');
  }

  BP.calc = { tokenize: tokenize, evaluate: evaluate, display: display };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.calc;
})(typeof self !== 'undefined' ? self : globalThis);
