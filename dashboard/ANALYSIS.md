# Swiss Citizen & Swiss Gymi: sales and marketing analysis

Data as of 22 Nov 2026, 11:00 CET. Sources: Stripe (live account, both products), Supabase
`swiss-citizen` and `swiss-gymi` databases, Resend, Gmail, Netlify.
**Missing: Google Ads spend, clicks and cost per click.** No Google Ads connector is connected,
so return on ad spend is computed against a break-even cost per click instead of real spend.

---

## 1. Swiss Citizen (swiss-citizen.com)

### 1.1 Revenue (Stripe, completed checkouts)

| Period | Sales | Price | Revenue |
|---|---|---|---|
| Apr–Sep 2026 | 19 | CHF 8 / 19 | CHF 251 |
| Oct 2026 | 3 | CHF 29 | CHF 87 |
| **Nov 1–22** | **15** | CHF 29 | **CHF 435** |
| **Lifetime** | **37** | | **CHF 773** |

- The October price rise from CHF 19 to CHF 29 did not hurt volume. November is the best month by far.
- Weekly sales are steady at about 5 (weeks of 2, 9, 16 Nov: 5, 3, 5).
- **Warning:** the last sale was 18 Nov. Visits fell from about 55 a day to 33 (20 Nov), 18 (21 Nov) and 7 (22 Nov, half a day). Ad visits fell from about 40 a day to 15. This looks like an ad budget, billing or campaign problem. **Check Google Ads today.**

### 1.2 Funnel, 1–22 Nov (first-party events)

| Step | Count | % of visits | Step conversion |
|---|---|---|---|
| Visit | 977 | 100% | |
| First answer | 552 | 56% | 56% |
| 5 answers | 495 | 51% | 90% |
| Paywall seen | 459 | 47% | 93% |
| Free round done | 399 | 41% | |
| Stripe checkout opened | 61 | 6.2% | 13% of paywall |
| **Paid** | **15** | **1.5%** | **25% of checkouts** |

Revenue per visit: about CHF 0.45.

### 1.3 Checkout: the biggest leak

Stripe sessions since 1 Oct (Swiss Citizen):

| Device | Paid | Expired | Completion |
|---|---|---|---|
| Mobile | 10 | 36 | **22%** |
| Desktop | 8 | 16 | **33%** |

- 35 of the 37 expired sessions **never attempted a payment**. The page loaded and the buyer left. Only 2 were attempts that failed. So this is hesitation, not a payment problem.
- TWINT, Apple Pay, Google Pay, Link and cards are already on, and a 30-day money-back guarantee is shown. Those basics are covered.
- Payers spend 45–90 seconds on the checkout page.
- 3 expired sessions came from Tanzania (TZ), probably tests. Exclude them when you judge completion.
- Abandoned value since 1 Oct: about CHF 1,300 (46 sessions × CHF 29).

**Why people may hesitate:** CHF 29 is a stranger's charge on a Stripe page. The site never asks for an email before checkout, so there is nothing to follow up with, and Stripe can't send recovery emails because `consent_collection` is off on the payment links.

### 1.4 Ads compared with everything else

Ad tagging (`client_reference_id … _gads`) started on 8–9 Nov:

| Since 9 Nov | Visits | Sales | Visit to sale |
|---|---|---|---|
| Google Ads | 523 | 7 | 1.34% |
| Other | 144 | 2 | 1.39% |

- Ads bring **78% of visits and 78% of sales**. Ad traffic converts as well as organic traffic, so the targeting is fine.
- Revenue per ad visit: CHF 0.39 gross, **CHF 0.37 after Stripe fees, which is your break-even cost per click**. If your average cost per click is above CHF 0.37, ads lose money on the first purchase.
- From 1–8 Nov (before tagging), the source split is unknown for 6 sales.

### 1.5 Language and region

| Language | Visits | First answer | Paywall → checkout click |
|---|---|---|---|
| DE | 672 | 55% | 8.4% |
| FR | 207 | **71%** | **4.0%** |
| EN | 97 | 34% | **28%** |

- French users are the most engaged and the least likely to buy. Stripe shows **one** French checkout in November. Vaud: 49 paywall views → 1 checkout click. This is the cheapest revenue to recover. Check the French paywall, the price display and the French payment link (created 17 Nov) on a phone.
- English users are few but buy readily, which fits expat professionals. Consider a small English-only ad group.
- Canton data for visits is unreliable, because visits default to ZH before the user picks a canton. Use paywall → checkout click instead: BE 14%, ZH 12%, TG 29% (small sample), VD 2%, AG 3%.

### 1.6 Other marketing channels

| Channel | Visits in Nov | Verdict |
|---|---|---|
| Google Ads | 651 | The main engine |
| Direct / untagged | 269 | Word of mouth and returning users |
| SEO "guide" pages | 34 | Small; worth growing over time |
| LinkedIn (4 posts: 1 published, 2 scheduled, 1 draft) | 1 | Credibility only, not sales |
| Meta | 3 | Negligible |
| Video (33 opens → 7 completed, 19 closed the card) | | Low engagement |

- **Email:** 88 sent through Resend since 24 Oct (purchase and support emails), with 0 opens and 0 clicks recorded. Open and click tracking is probably off, so it can't be judged. **Only 1 reminder subscriber** out of 399 people who finished the free test.
- **The paywall offer added on 14 Nov:** before it, 1.34% of visits ended in a sale (8 of 598). After it, 1.84% (7 of 381). The paywall → checkout click rate went from 8.1% to 9.1%. Promising, but too few sales to be sure.
- Feedback: one user wrote "Wieso ist es p2w" ("why is it pay-to-win?"). The free part must feel worth it on its own.

---

## 2. Swiss Gymi (swiss-gymi.com)

### 2.1 Products (Stripe)

| Product | Price | Validity |
|---|---|---|
| Mathe (kindergarten to 6th grade) | CHF 9 (2 children CHF 12; each extra child CHF 3) | 8 years |
| ZAP Pass (ZAP1 + ZAP2) | CHF 79 (2 children CHF 98; CHF 69 / 89 if Mathe was bought) | 3 years |
| Older prices still active | CHF 149 ZAP pass, CHF 79 "Endspurt", CHF 29 a month | |

The ZAP (the Zurich Gymi entrance exam) is on **9 March 2027, 15 weeks from now**.

### 2.2 Results so far

- **Revenue: CHF 9 (1 Mathe sale on 15 Nov).** No ZAP Pass has ever been sold; the one ZAP checkout (CHF 98, in August) expired.
- Checkouts: 7 Mathe sessions in November, 1 paid. The 5 desktop sessions that expired never attempted payment, which suggests tests.
- Accounts: 3 families and 3 learners, probably including your own. 220 practice events, almost all basic arithmetic.
- **Trial funnel, 11–20 Nov:** 22 visitors opened the Gymi trial (7 from ads, 15 organic) → **1 started** → 3 paywall views. All 7 ad visitors left before starting.
- One Mathe trial ran end to end (open → start → six tasks → done → offer), the path that produced the sale.
- 3 user reports are still open (status "neu"), and 6 client errors are logged.
- Only 2 emails sent.

### 2.3 What the numbers say

1. The product is not the problem yet. **Starting the trial is.** About 5% of visitors who open the trial begin it, so ad money is wasted until that improves.
2. The price ladder (CHF 9 entry, CHF 79 ZAP Pass) is sensible. Nobody has reached the CHF 79 offer yet.
3. December to early March is the buying season. Parents decide in December and January, so the time to fix things is now.
4. Your Swiss Citizen buyers are mostly German-speaking Zurich residents, very likely including parents. That is a free audience for Gymi.

---

## 3. Recommendations, in priority order

### This week
1. **Find out why traffic dropped on 20–22 Nov** (budget, billing, a disapproved ad, or limited by budget). That is about 1.5 sales a day lost while it lasts.
2. **Fix the French flow.** Walk through it on a phone: paywall, price, button, the French payment link, and the return page.
3. **Collect emails before checkout.** For example: "Get your weak topics and a reminder before your test date" on the result screen. Then send 3 emails (your result, your weakest topic, a reminder with the offer). Separately, turn on Stripe consent collection and recovery emails for expired checkouts.
4. **Add the Google Ads data** with a connector (Adspirer, Windsor.ai or Supermetrics) or by pasting a CSV into the dashboard. Compare your cost per click with **CHF 0.37**.

### Next 2–4 weeks
5. **Make checkout feel safer on mobile**, where only 22% complete. Show "one-time CHF 29 · TWINT · 30-day refund" right above the button on the site, before the Stripe redirect. Show a sample premium question so people know what they're buying.
6. **Publish the 28 Feb 2027 vote content** (citizenship after 5 years instead of 10): a landing page, a LinkedIn post and an ad group. Searches will spike in January and February.
7. **Swiss Gymi: rebuild the trial start.** One tap goes straight into a real ZAP-style task with no setup. Measure the open → start rate. Target 30% or more before raising ad spend.
8. **Swiss Gymi: cross-promote.** Show a "Preparing a child for the Gymi?" card to Swiss Citizen buyers after purchase.

### Ongoing
9. Turn on Resend open and click tracking so email can be judged.
10. Keep LinkedIn for credibility and don't expect sales from it. Drop the video card if fewer than about 20% keep watching.
11. Answer the 3 open Gymi reports and fix the logged errors.

---

## 4. Data and tracking gaps
- No Google Ads cost data, so return on ad spend can't be calculated.
- `checkout_click` records 39 clicks against 61 real Stripe sessions, and `checkout_return` records 5 against 15 sales. Some clicks and returns aren't logged.
- 6 November sales predate ad tagging.
- Canton is set to ZH by default on visits.
- Email open and click tracking appears to be off.
