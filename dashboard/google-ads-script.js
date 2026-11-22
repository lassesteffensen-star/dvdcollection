/**
 * Swiss Citizen / Swiss Gymi: daily Google Ads -> Sales dashboard.
 *
 * Install (once, about 5 minutes):
 *  1. Google Ads -> Tools -> Bulk actions -> Scripts -> "+" -> New script.
 *  2. Paste this whole file. Replace PASTE_INGEST_TOKEN_HERE with your ADS_INGEST_TOKEN.
 *  3. Click Authorize, then Preview (it should log "stored N rows").
 *  4. Save, then set Frequency = Daily, around 06:00.
 *
 * Every run sends the last LOOKBACK_DAYS days per campaign (cost, clicks, impressions, conversions),
 * so late conversions and cost corrections are picked up. The first run sends 90 days of history.
 * Campaigns are mapped to a product by name: Gymi / ZAP / Mathe -> Swiss Gymi; Citizen / Einbürgerung -> Swiss Citizen.
 * The token can only write ad stats. It cannot read the dashboard.
 */
var ENDPOINT = 'https://hozjqfzydxdnrttexlay.supabase.co/functions/v1/sales-dashboard/ingest';
var INGEST_TOKEN = 'PASTE_INGEST_TOKEN_HERE';
var LOOKBACK_DAYS = 14;
var FIRST_RUN_DAYS = 90;

function main() {
  var account = AdsApp.currentAccount();
  var currency = account.getCurrencyCode();
  if (currency !== 'CHF') Logger.log('WARNING: account currency is ' + currency + ', the dashboard assumes CHF.');

  var props = PropertiesService.getScriptProperties();
  var firstRun = !props.getProperty('initialised');
  var days = firstRun ? FIRST_RUN_DAYS : LOOKBACK_DAYS;
  var tz = account.getTimeZone();
  var end = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var start = Utilities.formatDate(new Date(Date.now() - days * 864e5), tz, 'yyyy-MM-dd');

  var query =
    'SELECT segments.date, campaign.id, campaign.name, metrics.impressions, metrics.clicks, ' +
    'metrics.cost_micros, metrics.conversions, metrics.conversions_value ' +
    'FROM campaign WHERE segments.date BETWEEN "' + start + '" AND "' + end + '" AND metrics.impressions > 0';

  var rows = [];
  var it = AdsApp.search(query);
  while (it.hasNext()) {
    var r = it.next();
    rows.push({
      day: r.segments.date,
      campaign: r.campaign.name,
      campaign_id: String(r.campaign.id),
      impressions: Number(r.metrics.impressions || 0),
      clicks: Number(r.metrics.clicks || 0),
      cost: Number(r.metrics.costMicros || 0) / 1e6,
      conversions: Number(r.metrics.conversions || 0),
      conv_value: Number(r.metrics.conversionsValue || 0)
    });
  }

  var stored = 0;
  for (var i = 0; i < rows.length; i += 2000) {
    var resp = UrlFetchApp.fetch(ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + INGEST_TOKEN },
      payload: JSON.stringify({ rows: rows.slice(i, i + 2000) }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) throw new Error('Dashboard rejected the data: ' + resp.getResponseCode() + ' ' + resp.getContentText());
    stored += JSON.parse(resp.getContentText()).stored;
  }
  props.setProperty('initialised', '1');
  Logger.log('stored ' + stored + ' rows (' + start + ' .. ' + end + ', ' + rows.length + ' campaign-days)');
}
