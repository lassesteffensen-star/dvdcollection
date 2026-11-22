// Sales dashboard API for Swiss Gymi (Supabase project swiss-gymi). Read-only aggregates, no personal data.
// GET /?from=YYYY-MM-DD&to=YYYY-MM-DD   Bearer <dashboard token>
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
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function range(url) {
  const iso = (d) => d.toISOString().slice(0, 10);
  let to = url.searchParams.get("to"), from = url.searchParams.get("from");
  if (!to || !DAY.test(to)) to = iso(new Date());
  if (!from || !DAY.test(from)) from = iso(new Date(Date.parse(to) - 29 * 864e5));
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
function cors(req, env) {
  const origin = req.headers.get("origin") || "";
  const allowed = String(env.DASHBOARD_ORIGINS || "https://swiss-sales-dashboard.netlify.app").split(",").map((s) => s.trim());
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return { "Access-Control-Allow-Origin": ok ? origin : allowed[0], "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin" };
}
const json = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" } });
let cache = null;
export function _resetCache() { cache = null; }

export async function handle(req, env, fetchImpl = fetch) {
  const h = cors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405, h);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) return json({ error: "server not configured" }, 500, h);
  const m = /^Bearer\s+([A-Za-z0-9_-]{16,128})$/.exec(req.headers.get("authorization") || "");
  if (!m) return json({ error: "unauthorized" }, 401, h);
  const sb = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (!cache || Date.now() - cache.at > 60_000) {
    const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/dashboard_access?id=eq.1&select=token_hash`, { headers: sb });
    const rows = r.ok ? await r.json() : [];
    cache = rows[0] ? { at: Date.now(), hash: rows[0].token_hash } : null;
  }
  if (!cache || !safeEqual(await sha256Hex(m[1]), cache.hash)) return json({ error: "unauthorized" }, 401, h);
  const { from, to } = range(new URL(req.url));
  const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/dashboard_gymi`, { method: "POST", headers: sb, body: JSON.stringify({ p_from: from, p_to: to }) });
  if (!r.ok) return json({ error: "query failed" }, 500, h);
  return json({ from, to, generated_at: new Date().toISOString(), gymi: await r.json() }, 200, h);
}
