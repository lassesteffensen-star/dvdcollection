// Sales & Ads dashboard. Plain JS, no dependencies. Data: two Supabase edge functions (aggregates only).
const API = {
  citizen: "https://hozjqfzydxdnrttexlay.supabase.co/functions/v1/sales-dashboard",
  gymi: "https://hkjyzuimbamkmcvhqyto.supabase.co/functions/v1/gymi-dashboard",
};
const ZAP_DATE = "2027-03-09";
const SC_PRICE = 29;
const TAG_START = "2026-11-08";
const fee = (gross) => gross * 0.029 + 0.3; // Stripe CH card fee, approx.
const TOKEN_KEY = "salesDashToken";
const DAYS_KEY = "salesDashDays";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf0 = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const chf = (v, d = 0) => v == null || !isFinite(v) ? "–" : "CHF " + (d ? nf2 : nf0).format(v);
const int = (v) => v == null || !isFinite(v) ? "–" : nf0.format(v);
const pct = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v * 100).toFixed(d).replace(/\.0$/, "") + "%";
const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const ratio = (a, b) => (b ? a / b : null);

function zurichToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const addDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const dayLabel = (iso) => { const d = new Date(iso + "T12:00:00Z"); return d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "."; };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

let state = { days: Number(localStorage.getItem(DAYS_KEY)) || 30, data: null };

// ---------- auth ----------
const token = () => localStorage.getItem(TOKEN_KEY);
function showLogin(msg = "") {
  $("#app").hidden = true; $("#login").hidden = false; $("#login-error").textContent = msg; $("#token").focus();
}
$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  localStorage.setItem(TOKEN_KEY, $("#token").value.trim());
  $("#token").value = "";
  boot();
});
$("#logout").addEventListener("click", () => { localStorage.removeItem(TOKEN_KEY); showLogin(); });
$("#refresh").addEventListener("click", () => load());
document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
  state.days = Number(b.dataset.days); localStorage.setItem(DAYS_KEY, state.days); load();
}));

async function getJSON(url) {
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token() } });
  if (r.status === 401) { const e = new Error("unauthorized"); e.code = 401; throw e; }
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function load() {
  document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", Number(b.dataset.days) === state.days));
  $("#updated").textContent = "Loading…";
  const to = zurichToday(), from = addDays(to, -(state.days * 2 - 1));
  const q = `?from=${from}&to=${to}`;
  try {
    const [c, g] = await Promise.all([getJSON(API.citizen + q), getJSON(API.gymi + q).catch((e) => ({ error: String(e.message) }))]);
    state.data = { c, g, to, curFrom: addDays(to, -(state.days - 1)), prevTo: addDays(to, -state.days) };
    render();
  } catch (e) {
    if (e.code === 401) return showLogin("That token was not accepted.");
    $("#updated").textContent = "Could not load data: " + e.message;
  }
}
function boot() {
  if (!token()) return showLogin();
  $("#login").hidden = true; $("#app").hidden = false;
  load();
}

// ---------- model ----------
function model() {
  const { c, g, to, curFrom, prevTo } = state.data;
  const C = c.citizen, inCur = (d) => d >= curFrom && d <= to, inPrev = (d) => d < curFrom && d <= prevTo;
  const daily = C.daily.map((d) => ({ ...d, revenue: d.revenue_rp / 100 }));
  const cur = daily.filter((d) => inCur(d.day)), prev = daily.filter((d) => inPrev(d.day));
  const agg = (rows) => {
    const visits = sum(rows, (d) => d.visits), visitsAds = sum(rows, (d) => d.visits_ads);
    const sales = sum(rows, (d) => d.sales), revenue = sum(rows, (d) => d.revenue);
    return { visits, visitsAds, sales, revenue, salesAds: sum(rows, (d) => d.sales_ads), salesOrg: sum(rows, (d) => d.sales_organic),
      first: sum(rows, (d) => d.first_answer), paywall: sum(rows, (d) => d.paywall), cc: sum(rows, (d) => d.checkout_click) };
  };
  const ads = (C.ads || []).map((a) => ({ ...a, cost_chf: Number(a.cost_chf), clicks: Number(a.clicks), impressions: Number(a.impressions) }));
  const adsAgg = (product, pred) => {
    const r = ads.filter((a) => a.product === product && pred(a.day));
    return { cost: sum(r, (a) => a.cost_chf), clicks: sum(r, (a) => a.clicks), impressions: sum(r, (a) => a.impressions), conv: sum(r, (a) => a.conversions), rows: r.length };
  };
  const stripe = c.stripe && !c.stripe.error ? c.stripe : null;
  const stripeAgg = (product, pred) => {
    if (!stripe) return null;
    const e = Object.entries(stripe[product] || {}).filter(([d]) => pred(d)).map(([, v]) => v);
    return { opened: sum(e, (v) => v.opened), paid: sum(e, (v) => v.paid), expired: sum(e, (v) => v.expired), revenue: sum(e, (v) => v.revenue_rp) / 100 };
  };
  const G = g && g.gymi;
  const trial = (pred) => {
    const t = {};
    for (const row of (G?.trial_daily || [])) if (pred(row.d)) for (const [k, v] of Object.entries(row.counts)) t[k] = (t[k] || 0) + Number(v);
    return t;
  };
  const ent = (pred) => sum((G?.entitlements || []).filter((e) => pred(e.d)), (e) => e.n);
  return {
    C, G, gErr: g && g.error, to, curFrom, daily: cur, cur: agg(cur), prev: agg(prev),
    ads: { sc: adsAgg("citizen", inCur), scPrev: adsAgg("citizen", inPrev), gy: adsAgg("gymi", inCur), other: adsAgg("other", inCur), any: ads.length > 0 },
    adsDaily: ads, campaigns: campaignsFor(C.campaign_days || [], inCur),
    stripe: stripe ? { sc: stripeAgg("citizen", inCur), gy: stripeAgg("gymi", inCur) } : null, stripeErr: c.stripe && c.stripe.error,
    trial: trial(inCur), trialPrev: trial(inPrev), gySales: ent(inCur), gySalesPrev: ent(inPrev),
  };
}

function campaignsFor(rows, pred) {
  const by = new Map();
  for (const r of rows) {
    if (!pred(r.day)) continue;
    const k = r.product + "|" + r.campaign;
    const c = by.get(k) || { product: r.product, campaign: r.campaign, impressions: 0, clicks: 0, cost_chf: 0, conversions: 0 };
    c.impressions += Number(r.impressions); c.clicks += Number(r.clicks); c.cost_chf += Number(r.cost_chf); c.conversions += Number(r.conversions);
    by.set(k, c);
  }
  return [...by.values()].sort((a, b) => b.cost_chf - a.cost_chf);
}

// ---------- render ----------
function delta(cur, prev, { invert = false, fmt = (v) => pct(v, 0) } = {}) {
  if (!prev || cur == null) return "";
  const r = (cur - prev) / prev;
  if (!isFinite(r) || Math.abs(r) < 0.005) return `<span>±0% vs prev.</span>`;
  const good = invert ? r < 0 : r > 0;
  return `<span class="${good ? "delta-up" : "delta-down"}">${r > 0 ? "▲" : "▼"} ${fmt(Math.abs(r))}</span> vs prev.`;
}
const tile = (label, value, sub = "", empty = false) =>
  `<div class="tile${empty ? " empty" : ""}"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;

function render() {
  const m = model();
  const { cur, prev } = m;
  const gen = new Date(state.data.c.generated_at);
  $("#updated").textContent = `${dayLabel(m.curFrom)} – ${dayLabel(m.to)} (last ${state.days} days) · updated ${gen.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`;
  const lt = m.C.lifetime;
  $("#sc-lifetime").textContent = `Lifetime: ${int(lt.sales)} sales · ${chf(lt.revenue_rp / 100)}`;

  // break-even CPC: net revenue from ad-attributed sales per ad visit
  const avgPrice = cur.sales ? cur.revenue / cur.sales : SC_PRICE;
  const netPerSale = avgPrice - fee(avgPrice);
  // Ad tagging of sales began 8 Nov 2026; before that ad-attributed sales read as 0. Use tagged days only, whole loaded range.
  const tagged = m.C.daily.filter((d) => d.day >= TAG_START);
  const tv = sum(tagged, (d) => d.visits_ads), ts = sum(tagged, (d) => d.sales_ads);
  const breakEvenCpc = tv >= 50 ? (ts * netPerSale) / tv : null;
  const cpc = ratio(m.ads.sc.cost, m.ads.sc.clicks);
  // ROAS only over days where sales carry the ads tag (TAG_START onward), inside the selected period.
  const spendTagged = sum(m.adsDaily.filter((x) => x.product === "citizen" && x.day >= TAG_START && x.day >= m.curFrom && x.day <= m.to), (x) => x.cost_chf);
  const roas = spendTagged ? (sum(m.daily.filter((d) => d.day >= TAG_START), (d) => d.sales_ads) * avgPrice) / spendTagged : null;

  // tiles
  const conv = ratio(cur.sales, cur.visits), convPrev = ratio(prev.sales, prev.visits);
  $("#sc-tiles").innerHTML = [
    tile("Revenue", chf(cur.revenue), delta(cur.revenue, prev.revenue)),
    tile("Sales", int(cur.sales), delta(cur.sales, prev.sales)),
    tile("Visits", int(cur.visits), delta(cur.visits, prev.visits)),
    tile("Visit → sale", pct(conv, 2), convPrev ? `prev. ${pct(convPrev, 2)}` : ""),
    tile("Revenue / visit", chf(ratio(cur.revenue, cur.visits), 2), ""),
    m.ads.sc.cost ? tile("Ad spend", chf(m.ads.sc.cost), `ROAS ${roas == null ? "–" : roas.toFixed(2) + "×"}`)
                  : tile("Ad spend", "No data", "connect Google Ads below", true),
    tile("Break-even CPC", chf(breakEvenCpc, 2), cpc != null ? `actual CPC ${chf(cpc, 2)}` : "max per click, from tagged sales"),
  ].join("");

  // charts
  barChart($("#sc-revenue"), m.daily, [{ key: "revenue", label: "Revenue", color: "var(--series-1)", fmt: (v) => chf(v) }], {
    yfmt: (v) => nf0.format(v), extra: (d) => [["Sales", int(d.sales)], ["of which ads", int(d.sales_ads)]] });
  barChart($("#sc-visits"), m.daily.map((d) => ({ ...d, other: d.visits - d.visits_ads })),
    [{ key: "visits_ads", label: "Google Ads", color: "var(--series-1)" }, { key: "other", label: "Other", color: "var(--series-3)" }],
    { yfmt: (v) => nf0.format(v), extra: (d) => [["Total", int(d.visits)]] });

  // funnel
  const st = m.stripe && m.stripe.sc;
  funnel($("#sc-funnel"), [
    ["Visits", cur.visits], ["First answer", cur.first], ["Paywall seen", cur.paywall],
    ...(st ? [["Checkout opened", st.opened]] : [["Checkout click", cur.cc]]), ["Paid", cur.sales],
  ]);
  $("#sc-checkout-note").textContent = st
    ? `Stripe checkout completion: ${pct(ratio(st.paid, st.opened), 0)} (${st.paid} of ${st.opened}; ${st.expired} expired).`
    : (m.stripeErr ? `Stripe data unavailable (${m.stripeErr}).` : "Checkout click is logged by the site and undercounts. Add a Stripe read key to see real checkout opens and completion.");

  // ads card
  $("#sc-ads").innerHTML = adsCard(m.ads.sc, { sales: cur.salesAds, revenue: roas != null ? roas * m.ads.sc.cost : null, visitsAds: cur.visitsAds, breakEvenCpc, campaigns: m.campaigns.filter((c) => c.product === "citizen") });

  // language table
  const ls = m.C.lang_sales || {};
  const langs = [...m.C.lang].filter((l) => l.visits > 2 || ls[l.lang]).sort((a, b) => b.visits - a.visits);
  $("#sc-lang").innerHTML = `<caption class="muted small" style="caption-side:bottom;text-align:left;padding-top:6px">Whole loaded range (2× period). Sales with unknown language: ${int(ls["?"] || 0)}.</caption>
    <thead><tr><th>Language</th><th>Visits</th><th>Answer rate</th><th>Paywall → checkout</th><th>Sales</th></tr></thead><tbody>` +
    langs.map((l) => `<tr><td>${esc(l.lang.toUpperCase())}</td><td>${int(l.visits)}</td><td>${pct(ratio(l.first_answer, l.visits), 0)}</td><td>${pct(ratio(l.checkout_click || 0, l.paywall), 1)}</td><td>${int(ls[l.lang] || 0)}</td></tr>`).join("") + "</tbody>";

  // sources
  const srcs = [...m.C.sources].sort((a, b) => b.visits - a.visits);
  const srcName = { gads: "Google Ads", untagged: "Untagged", direct: "Direct", guide: "Guide pages", google: "Google organic", site: "Own site", meta: "Meta", linkedin: "LinkedIn", ref: "Referral" };
  hbars($("#sc-sources"), srcs.map((s) => [srcName[s.src] || s.src, Number(s.visits)]));

  renderGymi(m);
  renderAlerts(m, { breakEvenCpc, cpc });
  renderAdsStatus(m);
}

function adsCard(a, { sales, revenue, visitsAds, breakEvenCpc, campaigns, salesLabel = "Ad-attributed sales", costPer = null }) {
  if (!a.rows) {
    return `<div class="kv"><div><span>Ad visits</span><b>${int(visitsAds)}</b></div><div><span>${salesLabel}</span><b>${int(sales)}</b></div>
      ${breakEvenCpc != null ? `<div><span>Break-even CPC</span><b>${chf(breakEvenCpc, 2)}</b></div>` : ""}</div>
      <p class="empty-state">No Google Ads cost data yet. Install the Google Ads Script (see README) or import a CSV below to see spend, CPC and ROAS.</p>`;
  }
  const cpc = ratio(a.cost, a.clicks);
  const ok = breakEvenCpc != null && cpc != null ? cpc <= breakEvenCpc : null;
  const rows = (campaigns || []).slice(0, 8).map((c) => `<tr><td title="${esc(c.campaign)}">${esc(String(c.campaign).slice(0, 34))}</td><td>${chf(Number(c.cost_chf), 2)}</td><td>${int(c.clicks)}</td><td>${chf(ratio(Number(c.cost_chf), Number(c.clicks)), 2)}</td><td>${pct(ratio(Number(c.clicks), Number(c.impressions)), 1)}</td></tr>`).join("");
  return `<div class="kv">
      <div><span>Spend</span><b>${chf(a.cost)}</b></div>
      <div><span>Clicks</span><b>${int(a.clicks)}</b></div>
      <div><span>CPC</span><b>${chf(cpc, 2)}</b> ${ok == null ? "" : `<span class="pill ${ok ? "good" : "bad"}">${ok ? "✓ under" : "✕ over"} break-even</span>`}</div>
      <div><span>${salesLabel}</span><b>${int(sales)}</b></div>
      <div><span>${costPer ? costPer[0] : "Cost / sale"}</span><b>${chf(costPer ? costPer[1] : ratio(a.cost, sales), 2)}</b></div>
      <div><span>ROAS</span><b>${revenue != null && a.cost ? (revenue / a.cost).toFixed(2) + "×" : "–"}</b></div>
    </div>
    ${rows ? `<div class="tablewrap"><table><thead><tr><th>Campaign</th><th>Spend</th><th>Clicks</th><th>CPC</th><th>CTR</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}`;
}

function renderGymi(m) {
  const days = daysBetween(zurichToday(), ZAP_DATE);
  $("#gy-zap").textContent = days > 0 ? `ZAP exam in ${days} days (9 March 2027)` : "";
  if (!m.G) { $("#gy-tiles").innerHTML = `<p class="empty-state">Swiss Gymi data unavailable${m.gErr ? ` (${esc(m.gErr)})` : ""}.</p>`; return; }
  const t = m.trial, tp = m.trialPrev, G = m.G;
  const opens = (t.g_open_ad || 0) + (t.g_open_org || 0), opensPrev = (tp.g_open_ad || 0) + (tp.g_open_org || 0);
  const starts = (t.g_start_ad || 0) + (t.g_start_org || 0);
  const mOpen = (t.m_open_ad || 0) + (t.m_open_org || 0), mStart = (t.m_start_ad || 0) + (t.m_start_org || 0);
  const mDone = (t.m_done_ad || 0) + (t.m_done_org || 0), offers = (t.m_offer_ad || 0) + (t.m_offer_org || 0) + (t.wall || 0);
  const st = m.stripe && m.stripe.gy;
  $("#gy-tiles").innerHTML = [
    tile("Sales", int(m.gySales), delta(m.gySales, m.gySalesPrev)),
    st ? tile("Revenue", chf(st.revenue), `${st.paid} of ${st.opened} checkouts paid`) : tile("Revenue", "–", "needs Stripe read key", true),
    tile("Gymi trial opens", int(opens), delta(opens, opensPrev)),
    tile("Open → start", pct(ratio(starts, opens), 0), `${int(starts)} started`),
    tile("Families", int(G.lifetime.families), `${int(G.lifetime.active_learners_7d)} active learners (7d)`),
    tile("Open reports", int(G.reports_open), `${int(G.errors_7d)} errors (7d)`),
  ].join("");
  funnel($("#gy-funnel"), [
    ["Gymi opened", opens, `ads ${int(t.g_open_ad || 0)}`], ["Gymi started", starts],
    ["Mathe opened", mOpen], ["Mathe started", mStart], ["Mathe finished", mDone], ["Offer / paywall", offers], ["Paid", m.gySales],
  ], { relative: false });
  $("#gy-ads").innerHTML = adsCard(m.ads.gy, { sales: m.gySales, revenue: st ? st.revenue : null, visitsAds: t.g_open_ad || 0, breakEvenCpc: null,
    campaigns: m.campaigns.filter((c) => c.product === "gymi"), salesLabel: "Sales (all sources)",
    costPer: ["Cost / trial open (ads)", ratio(m.ads.gy.cost, t.g_open_ad || 0)] });
}

function renderAlerts(m, { breakEvenCpc, cpc }) {
  const out = [];
  const add = (level, html) => out.push(`<div class="alert ${level}"><span class="ico" aria-hidden="true">${level === "good" ? "✓" : "!"}</span><div><span class="sr-only">${level}: </span>${html}</div></div>`);
  const last = m.C.lifetime.last_sale;
  if (last) {
    const d = daysBetween(new Date(last).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }), m.to);
    if (d >= 4) add("critical", `<b>No Swiss Citizen sale for ${d} days</b> (last: ${new Date(last).toLocaleDateString("de-CH")}). Usual pace is ~5 a week.`);
    else if (d >= 2) add("warning", `<b>No sale for ${d} days.</b>`);
  }
  // traffic: last 2 full days vs the 7 full days before
  const all = m.C.daily, n = all.length;
  if (n >= 10) {
    const recent = all.slice(n - 3, n - 1), base = all.slice(n - 10, n - 3);
    const r = sum(recent, (d) => d.visits) / 2, b = sum(base, (d) => d.visits) / 7;
    if (b > 10 && r < b * 0.65) add("critical", `<b>Traffic down ${pct(1 - r / b, 0)}</b>: ${Math.round(r)} visits/day in the last 2 days vs ${Math.round(b)} before. Ad visits: ${Math.round(sum(recent, (d) => d.visits_ads) / 2)}/day vs ${Math.round(sum(base, (d) => d.visits_ads) / 7)}. Check Google Ads budget, billing and ad status.`);
  }
  if (cpc != null && breakEvenCpc != null) {
    if (cpc > breakEvenCpc) add("critical", `<b>Ads lose money on first purchase:</b> CPC ${chf(cpc, 2)} vs break-even ${chf(breakEvenCpc, 2)}.`);
    else add("good", `<b>Ads are profitable:</b> CPC ${chf(cpc, 2)} is below the break-even ${chf(breakEvenCpc, 2)}.`);
  }
  if (!m.ads.any) add("warning", `<b>No Google Ads cost data.</b> ROAS and CPC can't be calculated. Install the Google Ads Script or import a CSV (bottom of the page).`);
  else if (m.C.ads_last_update && (Date.now() - Date.parse(m.C.ads_last_update)) > 2.5 * 864e5) add("warning", `<b>Google Ads data is stale</b> (last update ${new Date(m.C.ads_last_update).toLocaleDateString("de-CH")}).`);
  const lang = Object.fromEntries(m.C.lang.map((l) => [l.lang, l]));
  if (lang.fr && lang.de && lang.fr.paywall >= 30) {
    const fr = ratio(lang.fr.checkout_click || 0, lang.fr.paywall), de = ratio(lang.de.checkout_click || 0, lang.de.paywall);
    if (de && fr < de * 0.6) add("warning", `<b>French paywall underperforms:</b> ${pct(fr)} of FR paywall views click to buy vs ${pct(de)} in DE.`);
  }
  if (m.G && m.G.reports_open > 0) add("warning", `<b>${m.G.reports_open} open Swiss Gymi user report${m.G.reports_open > 1 ? "s" : ""}.</b>`);
  if (m.C.email && m.C.email.reminder_subscribers < 5) add("warning", `<b>Email capture is near zero</b> (${m.C.email.reminder_subscribers} active reminder subscribers).`);
  $("#alerts").innerHTML = out.join("");
}

function renderAdsStatus(m) {
  const u = m.C.ads_last_update;
  $("#ads-status").innerHTML = u
    ? `Last update ${new Date(u).toLocaleString("de-CH")} · ${m.campaigns.length} campaign(s) in range · ${int(m.ads.other.cost ? m.ads.other.cost : 0)} CHF on campaigns not matched to a product.`
    : `No Google Ads data yet. Recommended: install the daily Google Ads Script (it sends cost, clicks and conversions per campaign every morning). Or import a CSV now:`;
}

// ---------- charts ----------
const tip = $("#tip");
function showTip(e, html) { tip.innerHTML = html; tip.hidden = false; moveTip(e); }
function moveTip(e) {
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => { tip.hidden = true; };

function niceMax(v) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function topRounded(x, y, w, h, r) {
  if (h <= 0) return "";
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function barChart(el, rows, series, { yfmt = String, extra = () => [] } = {}) {
  const W = Math.max(el.clientWidth, 280), H = 220, m = { t: 8, r: 4, b: 22, l: 36 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const totals = rows.map((d) => sum(series, (s) => d[s.key]));
  const max = niceMax(Math.max(...totals, 0)), ticks = 4;
  const step = iw / Math.max(rows.length, 1), bw = Math.max(2, Math.min(28, step * 0.7));
  const y = (v) => m.t + ih - (v / max) * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((x) => x.label).join(", "))} per day">`;
  s += `<g class="grid">`;
  for (let i = 1; i <= ticks; i++) { const v = (max / ticks) * i; s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`; }
  s += `</g><g class="axis">`;
  for (let i = 0; i <= ticks; i++) { const v = (max / ticks) * i; s += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${yfmt(v)}</text>`; }
  const every = Math.ceil(rows.length / Math.max(2, Math.floor(iw / 52)));
  rows.forEach((d, i) => { const last = i === rows.length - 1; if ((i % every === 0 && (last || rows.length - 1 - i >= every)) || last) s += `<text x="${m.l + step * i + step / 2}" y="${H - 6}" text-anchor="middle">${dayLabel(d.day)}</text>`; });
  s += `</g>`;
  rows.forEach((d, i) => {
    const x = m.l + step * i + (step - bw) / 2;
    s += `<g class="col" data-i="${i}"><rect class="hit" x="${m.l + step * i}" y="${m.t}" width="${step}" height="${ih}"/>`;
    let base = 0;
    const visible = series.filter((sr) => d[sr.key] > 0);
    visible.forEach((sr, k) => {
      const v = d[sr.key], top = k === visible.length - 1;
      const y0 = y(base + v), h = y(base) - y0 - (k > 0 ? 2 : 0);
      s += top ? `<path class="bar" d="${topRounded(x, y0, bw, Math.max(h, 0), 4)}" fill="${sr.color}"/>`
               : `<rect class="bar" x="${x}" y="${y0}" width="${bw}" height="${Math.max(h, 0)}" fill="${sr.color}"/>`;
      base += v;
    });
    s += `</g>`;
  });
  s += `<line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
  el.innerHTML = s;
  el.querySelectorAll("g.col").forEach((g) => {
    const d = rows[+g.dataset.i];
    const html = `<b>${new Date(d.day + "T12:00:00Z").toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}</b>` +
      series.map((sr) => `<div class="r"><span><i class="sw" style="background:${sr.color};margin:0 6px 0 0"></i>${esc(sr.label)}</span><span>${(sr.fmt || int)(d[sr.key])}</span></div>`).join("") +
      extra(d).map(([k, v]) => `<div class="r"><span>${esc(k)}</span><span>${v}</span></div>`).join("");
    g.addEventListener("mouseenter", (e) => showTip(e, html));
    g.addEventListener("mousemove", moveTip);
    g.addEventListener("mouseleave", hideTip);
  });
}
function funnel(el, steps, { relative = true } = {}) {
  const max = Math.max(...steps.map((s) => s[1] || 0), 1);
  el.innerHTML = steps.map(([name, v, note], i) => {
    const prevV = i ? steps[i - 1][1] : null;
    const p = relative && i && prevV ? `<span class="pct">${pct(v / prevV, 0)}</span>` : note ? `<span class="pct">${esc(note)}</span>` : "";
    return `<div class="row"><span class="name">${esc(name)}</span><div class="track"><div class="fill" style="width:${(100 * (v || 0)) / max}%"></div></div><span class="num">${int(v || 0)}${p}</span></div>`;
  }).join("");
}
function hbars(el, items) {
  const max = Math.max(...items.map((i) => i[1]), 1), total = sum(items, (i) => i[1]);
  el.innerHTML = items.map(([name, v]) => `<div class="row"><span class="name">${esc(name)}</span><div class="track"><div class="fill" style="width:${(100 * v) / max}%"></div></div><span class="num">${int(v)}<span class="pct" style="color:var(--muted);margin-left:6px;font-size:12px">${pct(v / total, 0)}</span></span></div>`).join("");
}

let rt;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => state.data && render(), 150); });

// ---------- CSV import ----------
export function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  const delim = (text.split("\n").find((l) => /campaign|kampagne|campagne/i.test(l)) || "").split("\t").length > 3 ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
export function parseNumber(s) {
  s = String(s ?? "").replace(/[^\d.,'’\-]/g, "");
  if (!s || s === "-" || s === "--") return 0;
  if (/,\d{1,2}$/.test(s) && s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/[.'’]/g, "").replace(",", ".");
  else s = s.replace(/[,'’]/g, "");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
export function parseDate(s) {
  s = String(s || "").trim();
  let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const t = Date.parse(s + " 12:00 UTC");
  return isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}
export function adsRowsFromCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, ""));
  const hi = rows.findIndex((r) => r.some((c) => /^(campaign|kampagne|campagne)$/i.test(c.trim())));
  if (hi < 0) throw new Error("No 'Campaign' column found.");
  const H = rows[hi].map((c) => c.trim().toLowerCase());
  const col = (...names) => H.findIndex((h) => names.includes(h));
  const ix = { day: col("day", "date", "tag", "datum", "jour"), campaign: col("campaign", "kampagne", "campagne"),
    impr: col("impr.", "impressions", "impressionen"), clicks: col("clicks", "klicks", "clics"),
    cost: col("cost", "kosten", "coût", "cout"), conv: col("conversions", "conv.", "konversionen"),
    value: col("conv. value", "conversion value", "konv.-wert", "valeur de conv.") };
  if (ix.day < 0) throw new Error("No 'Day' column. In Google Ads use Segment → Time → Day before downloading.");
  if (ix.cost < 0) throw new Error("No 'Cost' column found.");
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const day = parseDate(r[ix.day]), campaign = (r[ix.campaign] || "").trim();
    if (!day || !campaign || /^total/i.test(campaign)) continue;
    out.push({ day, campaign, impressions: parseNumber(r[ix.impr]), clicks: parseNumber(r[ix.clicks]), cost: parseNumber(r[ix.cost]),
      conversions: ix.conv >= 0 ? parseNumber(r[ix.conv]) : 0, conv_value: ix.value >= 0 ? parseNumber(r[ix.value]) : 0 });
  }
  return out;
}
$("#csv").addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const out = $("#csv-result");
  try {
    const rows = adsRowsFromCSV(await file.text());
    if (!rows.length) throw new Error("No daily campaign rows found.");
    let stored = 0;
    for (let i = 0; i < rows.length; i += 2000) {
      const r = await fetch(API.citizen + "/ingest", { method: "POST", headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" }, body: JSON.stringify({ rows: rows.slice(i, i + 2000) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "HTTP " + r.status);
      stored += (await r.json()).stored;
    }
    out.textContent = `Imported ${stored} campaign-days (${rows[0].day} … ${rows[rows.length - 1].day}).`;
    load();
  } catch (err) { out.textContent = "Import failed: " + err.message; }
  e.target.value = "";
});

if (!globalThis.__NO_BOOT__) boot();
