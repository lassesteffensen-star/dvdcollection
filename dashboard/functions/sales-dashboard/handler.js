// Sales dashboard API for Swiss Citizen (Supabase project swiss-citizen). Runs on Supabase Edge (Deno) and in Node tests.
// GET  /?from=YYYY-MM-DD&to=YYYY-MM-DD   Bearer <dashboard token>  -> aggregates only, no personal data
// POST /ingest {rows:[...]}              Bearer <ingest token or dashboard token> -> upserts Google Ads daily stats
// Tokens are never stored: public.dashboard_access holds their SHA-256 hashes.

const enc = new TextEncoder();
export async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(String(s)));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export function bearer(req) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{16,128})$/.exec(req.headers.get("authorization") || "");
  return m ? m[1] : null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function range(url, today = new Date()) {
  const iso = (d) => d.toISOString().slice(0, 10);
  let to = url.searchParams.get("to"), from = url.searchParams.get("from");
  if (!to || !DAY.test(to)) to = iso(today);
  if (!from || !DAY.test(from)) from = iso(new Date(Date.parse(to) - 29 * 864e5));
  if (from > to) [from, to] = [to, from];
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > 400) from = iso(new Date(Date.parse(to) - 400 * 864e5));
  return { from, to };
}

// Campaign name -> product. Explicit product on the row wins.
export function productOf(row) {
  const p = String(row.product || "").toLowerCase();
  if (p === "citizen" || p === "gymi" || p === "other") return p;
  const n = String(row.campaign || "").toLowerCase();
  if (/gymi|zap|gymnasium|mathe/.test(n)) return "gymi";
  if (/citizen|einb[uü]rger|naturali|cittadin|staatsb/.test(n)) return "citizen";
  return "other";
}
const num = (v) => { const x = Number(String(v ?? "0").replace(/[’',\s]/g, "")); return Number.isFinite(x) ? x : 0; };
export function cleanRows(rows, source) {
  if (!Array.isArray(rows)) return { error: "rows must be an array" };
  if (rows.length > 5000) return { error: "too many rows (max 5000)" };
  const out = new Map();
  for (const r of rows) {
    const day = String(r.day || r.date || "").slice(0, 10);
    const campaign = String(r.campaign || "").trim().slice(0, 200);
    if (!DAY.test(day) || !campaign) continue;
    const row = {
      day, campaign, product: productOf(r),
      campaign_id: r.campaign_id ? String(r.campaign_id).slice(0, 40) : null,
      impressions: Math.round(num(r.impressions)), clicks: Math.round(num(r.clicks)),
      cost_chf: Math.round(num(r.cost ?? r.cost_chf) * 100) / 100,
      conversions: Math.round(num(r.conversions) * 100) / 100,
      conv_value_chf: Math.round(num(r.conv_value ?? r.conv_value_chf) * 100) / 100,
      source, updated_at: new Date().toISOString(),
    };
    const k = `${row.day}|${row.product}|${row.campaign}`;
    const prev = out.get(k);
    if (prev) { for (const f of ["impressions", "clicks", "cost_chf", "conversions", "conv_value_chf"]) prev[f] += row[f]; }
    else out.set(k, row);
  }
  return { rows: [...out.values()] };
}

// ---- Optional Stripe checkout stats (needs STRIPE_READ_KEY, a restricted key with Checkout Sessions: read) ----
export const SC_LINKS = new Set(["plink_1UPLPJJlnS81YvqwFQCfSPUX", "plink_1UbeU5JlnS81YvqweG9UIhvz", "plink_1UcuR4JlnS81YvqwFiTOPSly",
  "plink_1TONwJJlnS81YvqwxXiwXsEl", "plink_1TIwYeJlnS81YvqwfY7WhfOc", "plink_1TONWpJlnS81Yvqw1Kbqew2j"]);
export function sessionProduct(s) {
  const url = String(s.success_url || "");
  if (/swiss-gymi\.com/.test(url)) return "gymi";
  if ((s.payment_link && SC_LINKS.has(s.payment_link)) || /swiss-citizen\.com/.test(url)) return "citizen";
  const app = s.metadata && s.metadata.app;
  if (app === "swiss-gymi") return "gymi";
  if (app === "swiss-citizen") return "citizen";
  return "other";
}
export function zurichDay(unixSec) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(unixSec * 1000));
}
export function aggregateSessions(sessions) {
  const out = { citizen: {}, gymi: {} };
  for (const s of sessions) {
    const p = sessionProduct(s);
    if (!out[p]) continue;
    const d = zurichDay(s.created);
    const b = (out[p][d] ||= { opened: 0, paid: 0, expired: 0, revenue_rp: 0 });
    b.opened++;
    if (s.status === "complete" && s.payment_status === "paid") { b.paid++; b.revenue_rp += s.amount_total || 0; }
    else if (s.status === "expired") b.expired++;
  }
  return out;
}
async function stripeSessions(key, from, to, fetchImpl) {
  const gte = Math.floor(Date.parse(from + "T00:00:00+01:00") / 1000);
  const lt = Math.floor(Date.parse(to + "T00:00:00+01:00") / 1000) + 86400;
  const all = [];
  let after = null;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ limit: "100", "created[gte]": String(gte), "created[lt]": String(lt) });
    if (after) q.set("starting_after", after);
    const r = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions?${q}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`stripe ${r.status}`);
    const j = await r.json();
    for (const s of j.data) all.push({ id: s.id, created: s.created, status: s.status, payment_status: s.payment_status,
      amount_total: s.amount_total, payment_link: s.payment_link, success_url: s.success_url, metadata: s.metadata });
    if (!j.has_more || !j.data.length) break;
    after = j.data[j.data.length - 1].id;
  }
  return all;
}

// ---- HTTP ----
function cors(req, env) {
  const origin = req.headers.get("origin") || "";
  const allowed = String(env.DASHBOARD_ORIGINS || "https://swiss-sales-dashboard.netlify.app").split(",").map((s) => s.trim());
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400", Vary: "Origin",
  };
}
const json = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" } });

let cache = null; // { at, token_hash, ingest_hash }
export function _resetCache() { cache = null; }
async function hashes(env, fetchImpl) {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/dashboard_access?id=eq.1&select=token_hash,ingest_hash`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) return null;
  const [row] = await r.json();
  if (!row) return null;
  cache = { at: Date.now(), ...row };
  return cache;
}

export async function handle(req, env, fetchImpl = fetch) {
  const h = cors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "server not configured" }, 500, h);
  const tok = bearer(req);
  const hs = tok && (await hashes(env, fetchImpl));
  if (!tok || !hs) return json({ error: "unauthorized" }, 401, h);
  const th = await sha256Hex(tok);
  const isRead = safeEqual(th, hs.token_hash), isIngest = safeEqual(th, hs.ingest_hash);
  const url = new URL(req.url);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  if (req.method === "POST" && url.pathname.endsWith("/ingest")) {
    if (!isRead && !isIngest) return json({ error: "unauthorized" }, 401, h);
    let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, h); }
    const c = cleanRows(body && body.rows, isIngest ? "ads_script" : "csv");
    if (c.error) return json({ error: c.error }, 400, h);
    if (!c.rows.length) return json({ stored: 0 }, 200, h);
    const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/ad_spend?on_conflict=day,product,campaign`, {
      method: "POST", headers: { ...sb, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(c.rows) });
    if (!r.ok) return json({ error: "store failed" }, 500, h);
    return json({ stored: c.rows.length }, 200, h);
  }

  if (req.method === "GET") {
    if (!isRead) return json({ error: "unauthorized" }, 401, h);
    const { from, to } = range(url);
    const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/dashboard_citizen`, { method: "POST", headers: sb, body: JSON.stringify({ p_from: from, p_to: to }) });
    if (!r.ok) return json({ error: "query failed" }, 500, h);
    const data = await r.json();
    let stripe = null;
    if (env.STRIPE_READ_KEY) {
      try { stripe = aggregateSessions(await stripeSessions(env.STRIPE_READ_KEY, from, to, fetchImpl)); }
      catch (e) { stripe = { error: String(e.message || e) }; }
    }
    return json({ from, to, generated_at: new Date().toISOString(), citizen: data, stripe }, 200, h);
  }
  return json({ error: "not found" }, 404, h);
}
