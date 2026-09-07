/**
 * Calculator engine: tokenizes and evaluates arithmetic expressions with
 * correct operator precedence, without using eval().
 *
 * Supported: + - * / % (percent), unary minus, parentheses, decimals.
 */
(function (root) {
  'use strict';

  const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (ch === ' ') { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
        const text = expr.slice(i, j);
        if ((text.match(/\./g) || []).length > 1 || text === '.') {
          throw new Error('Invalid number: ' + text);
        }
        tokens.push({ type: 'num', value: parseFloat(text) });
        i = j;
        continue;
      }
      if ('+-*/()%'.includes(ch)) {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }
      throw new Error('Unexpected character: ' + ch);
    }
    return tokens;
  }

  // Recursive-descent parser: expr -> term (('+'|'-') term)*
  function parse(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function parsePrimary() {
      const t = next();
      if (!t) throw new Error('Unexpected end of expression');
      if (t.type === 'num') return t.value;
      if (t.value === '-') return -parsePrimary();
      if (t.value === '+') return parsePrimary();
      if (t.value === '(') {
        const v = parseExpr();
        const close = next();
        if (!close || close.value !== ')') throw new Error('Missing closing parenthesis');
        return v;
      }
      throw new Error('Unexpected token: ' + t.value);
    }

    function parsePostfix() {
      let v = parsePrimary();
      while (peek() && peek().value === '%') {
        next();
        v = v / 100;
      }
      return v;
    }

    function parseTerm() {
      let v = parsePostfix();
      while (peek() && (peek().value === '*' || peek().value === '/')) {
        const op = next().value;
        const rhs = parsePostfix();
        if (op === '*') v = v * rhs;
        else {
          if (rhs === 0) throw new Error('Cannot divide by zero');
          v = v / rhs;
        }
      }
      return v;
    }

    function parseExpr() {
      let v = parseTerm();
      while (peek() && (peek().value === '+' || peek().value === '-')) {
        const op = next().value;
        const rhs = parseTerm();
        v = op === '+' ? v + rhs : v - rhs;
      }
      return v;
    }

    const result = parseExpr();
    if (pos < tokens.length) throw new Error('Unexpected token: ' + tokens[pos].value);
    return result;
  }

  /** Round away floating-point noise (0.1 + 0.2 -> 0.3). */
  function normalize(n) {
    if (!isFinite(n)) throw new Error('Result is not a finite number');
    const rounded = parseFloat(n.toPrecision(12));
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  /** Evaluate an expression string and return a number. Throws on error. */
  function evaluate(expr) {
    const normalized = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    const tokens = tokenize(normalized);
    if (tokens.length === 0) throw new Error('Empty expression');
    return normalize(parse(tokens));
  }

  /** Format a number for display. */
  function format(n) {
    if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) {
      return n.toExponential(6).replace(/\.?0+e/, 'e');
    }
    return String(n);
  }

  const api = { evaluate, tokenize, format, PRECEDENCE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
