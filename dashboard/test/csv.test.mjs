import { test } from "node:test";
import assert from "node:assert/strict";

// app.js touches the DOM at import time; give it a tiny stub and skip boot.
globalThis.__NO_BOOT__ = true;
const el = () => ({ addEventListener() {}, set textContent(v) {}, set innerHTML(v) {}, hidden: false, classList: { toggle() {} } });
globalThis.document = { querySelector: el, querySelectorAll: () => [] };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.addEventListener = () => {};
const { parseCSV, parseNumber, parseDate, adsRowsFromCSV } = await import("../site/app.js");

test("numbers in Swiss, German and English formats", () => {
  assert.equal(parseNumber("1'234.50"), 1234.5);
  assert.equal(parseNumber("1,234.50"), 1234.5);
  assert.equal(parseNumber("12,50"), 12.5);
  assert.equal(parseNumber("1.234,50"), 1234.5);
  assert.equal(parseNumber("CHF 3.20"), 3.2);
  assert.equal(parseNumber("--"), 0);
});

test("dates", () => {
  assert.equal(parseDate("2026-11-20"), "2026-11-20");
  assert.equal(parseDate("20.11.2026"), "2026-11-20");
  assert.equal(parseDate("Nov 20, 2026"), "2026-11-20");
  assert.equal(parseDate("Total"), null);
});

test("quoted CSV fields", () => {
  assert.deepEqual(parseCSV('a,"b, c","d ""e"""\n1,2,3\n'), [["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
});

test("Google Ads campaign report export", () => {
  const csv = "﻿Campaign report\n\"November 1, 2026 - November 22, 2026\"\nDay,Campaign,Campaign status,Impr.,Clicks,Currency code,Cost,Conversions\n" +
    "2026-11-20,Swiss Citizen DE,Enabled,\"1,200\",40,CHF,23.50,1.00\n" +
    "2026-11-20,Gymi ZAP,Enabled,30,2,CHF,1.40,0.00\n" +
    "Total: Account,,,,,,24.90,1\n";
  const rows = adsRowsFromCSV(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { day: "2026-11-20", campaign: "Swiss Citizen DE", impressions: 1200, clicks: 40, cost: 23.5, conversions: 1, conv_value: 0 });
});

test("German export with tabs", () => {
  const tsv = "Tag\tKampagne\tImpr.\tKlicks\tKosten\n20.11.2026\tEinbürgerung DE\t100\t7\t3,50\n";
  assert.deepEqual(adsRowsFromCSV(tsv)[0], { day: "2026-11-20", campaign: "Einbürgerung DE", impressions: 100, clicks: 7, cost: 3.5, conversions: 0, conv_value: 0 });
});

test("missing Day column gives a helpful error", () => {
  assert.throws(() => adsRowsFromCSV("Campaign,Cost\nA,1\n"), /Segment/);
});
