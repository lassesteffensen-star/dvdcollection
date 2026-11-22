import { test } from "node:test";
import assert from "node:assert/strict";
import * as sc from "../functions/sales-dashboard/handler.js";
import * as gy from "../functions/gymi-dashboard/handler.js";

const READ = "r".repeat(48), INGEST = "i".repeat(48);
const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" };

function fakeFetch(log) {
  return async (url, opts = {}) => {
    log.push({ url, opts });
    if (url.includes("/dashboard_access")) return new Response(JSON.stringify([{ token_hash: await sc.sha256Hex(READ), ingest_hash: await sc.sha256Hex(INGEST) }]));
    if (url.includes("/rpc/dashboard_citizen")) return new Response(JSON.stringify({ daily: [] }));
    if (url.includes("/rpc/dashboard_gymi")) return new Response(JSON.stringify({ trial_totals: {} }));
    if (url.includes("/ad_spend")) return new Response(null, { status: 201 });
    return new Response("no", { status: 404 });
  };
}
const req = (path, tok, init = {}) => new Request("https://f.test/functions/v1/sales-dashboard" + path,
  { ...init, headers: { ...(tok ? { authorization: "Bearer " + tok } : {}), origin: "https://swiss-sales-dashboard.netlify.app" } });

test("rejects missing and wrong tokens", async () => {
  sc._resetCache();
  assert.equal((await sc.handle(req("/", null), env, fakeFetch([]))).status, 401);
  assert.equal((await sc.handle(req("/", "w".repeat(48)), env, fakeFetch([]))).status, 401);
});

test("ingest token cannot read; read token can", async () => {
  sc._resetCache();
  assert.equal((await sc.handle(req("/", INGEST), env, fakeFetch([]))).status, 401);
  const r = await sc.handle(req("/?from=2026-11-01&to=2026-11-22", READ), env, fakeFetch([]));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.from, "2026-11-01");
  assert.equal(j.stripe, null);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://swiss-sales-dashboard.netlify.app");
});

test("ingest upserts cleaned rows", async () => {
  sc._resetCache();
  const log = [];
  const body = JSON.stringify({ rows: [
    { day: "2026-11-20", campaign: "Swiss Citizen DE", impressions: "1,200", clicks: 40, cost: "23.5" },
    { day: "2026-11-20", campaign: "Swiss Citizen DE", impressions: 10, clicks: 1, cost: 0.5 },
    { day: "2026-11-20", campaign: "Gymi ZAP Zürich", clicks: 3, cost: 4 },
    { day: "bad", campaign: "x" } ] });
  const r = await sc.handle(new Request("https://f.test/functions/v1/sales-dashboard/ingest",
    { method: "POST", body, headers: { authorization: "Bearer " + INGEST } }), env, fakeFetch(log));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { stored: 2 });
  const sent = JSON.parse(log.find((l) => l.url.includes("/ad_spend")).opts.body);
  const c = sent.find((x) => x.product === "citizen");
  assert.equal(c.impressions, 1210); assert.equal(c.clicks, 41); assert.equal(c.cost_chf, 24); assert.equal(c.source, "ads_script");
  assert.equal(sent.find((x) => x.product === "gymi").clicks, 3);
});

test("product mapping and Stripe aggregation", () => {
  assert.equal(sc.productOf({ campaign: "Einbürgerungstest Search" }), "citizen");
  assert.equal(sc.productOf({ campaign: "ZAP Pass Mathe" }), "gymi");
  assert.equal(sc.productOf({ campaign: "Brand" }), "other");
  assert.equal(sc.productOf({ campaign: "x", product: "gymi" }), "gymi");
  const t = Date.parse("2026-11-20T12:00:00Z") / 1000;
  const a = sc.aggregateSessions([
    { created: t, status: "complete", payment_status: "paid", amount_total: 2900, payment_link: "plink_1UPLPJJlnS81YvqwFQCfSPUX" },
    { created: t, status: "expired", success_url: "https://swiss-citizen.com/?session_id=x" },
    { created: t, status: "expired", success_url: "https://swiss-gymi.com/danke/?k=mathe1" } ]);
  assert.deepEqual(a.citizen["2026-11-20"], { opened: 2, paid: 1, expired: 1, revenue_rp: 2900 });
  assert.equal(a.gymi["2026-11-20"].expired, 1);
});

test("gymi handler auth", async () => {
  gy._resetCache();
  const f = fakeFetch([]);
  assert.equal((await gy.handle(req("/", "w".repeat(48)), env, f)).status, 401);
  const r = await gy.handle(req("/", READ), env, f);
  assert.equal(r.status, 200);
  assert.ok((await r.json()).gymi);
});
