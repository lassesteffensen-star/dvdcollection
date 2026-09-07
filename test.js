const assert = require('assert');
const { evaluate, format } = require('./calculator');

const cases = [
  ['1+2', 3],
  ['2+3*4', 14],
  ['(2+3)*4', 20],
  ['10/4', 2.5],
  ['0.1+0.2', 0.3],
  ['-5+3', -2],
  ['2*-3', -6],
  ['50%', 0.5],
  ['200*10%', 20],
  ['7-2-1', 4],
  ['8/2/2', 2],
  ['3 × 4 ÷ 2', 6],
  ['1.5*2', 3],
  ['((1))', 1],
  ['-(2+3)', -5],
  ['1e', null], // 'e' is not a valid character
];

let failed = 0;
for (const [expr, expected] of cases) {
  try {
    const got = evaluate(expr);
    if (expected === null) throw new Error(`expected an error for "${expr}", got ${got}`);
    assert.strictEqual(got, expected, `${expr} => ${got}, expected ${expected}`);
    console.log(`ok   ${expr} = ${got}`);
  } catch (e) {
    if (expected === null && !/expected an error/.test(e.message)) {
      console.log(`ok   ${expr} throws: ${e.message}`);
    } else {
      failed++;
      console.log(`FAIL ${e.message}`);
    }
  }
}

const errorCases = ['1/0', '', '1+', '(1+2', '1..2', '2**3'];
for (const expr of errorCases) {
  try {
    const got = evaluate(expr);
    failed++;
    console.log(`FAIL "${expr}" should throw, got ${got}`);
  } catch (e) {
    console.log(`ok   "${expr}" throws: ${e.message}`);
  }
}

assert.strictEqual(format(1234), '1234');
assert.strictEqual(format(1e20), '1e+20');
assert.strictEqual(format(-0.5), '-0.5');
console.log('ok   format');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nAll tests passed');
