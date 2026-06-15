import { getDatabase } from "@/lib/db/sqlite";
import type { AlertBacktestRecord } from "@/lib/trust/types";
import type { Alert, TokenWithScores } from "@/lib/types";

type HistoricalAlertCandidate = {
  token_address: string;
  pair_address: string | null;
  observed_at: string;
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_1h: number | null;
  volume_24h: number | null;
  buys_5m: number | null;
  sells_5m: number | null;
};

export function trackAlert(record: AlertBacktestRecord) {
  insertRecord(`${record.token}-${record.alertType}-${record.firedAt}`, record);
}

export function trackGeneratedAlerts(alerts: Alert[], tokens: TokenWithScores[]) {
  const tokenByAddress = new Map(tokens.map((token) => [token.tokenAddress.toLowerCase(), token]));
  for (const alert of alerts) {
    const token = tokenByAddress.get(alert.tokenAddress.toLowerCase());
    insertRecord(`${alert.id}-${alertBucket(alert.createdAt)}`, {
      token: alert.tokenAddress.toLowerCase(),
      alertType: alert.type,
      firedAt: alert.createdAt,
      priceAtFire: token?.priceUsd ?? null,
      liquidityAtFire: token?.liquidityUsd ?? null,
      volumeAtFire: token?.volume24h ?? null,
      priceAfter5m: null,
      priceAfter1h: null,
      priceAfter24h: null,
      maxDrawdownAfter1h: null,
      maxUpsideAfter1h: null,
      outcome: "unknown"
    });
  }
}

function alertBucket(timestamp: string, bucketMs = 15 * 60_000) {
  const parsed = new Date(timestamp).getTime();
  const value = Number.isFinite(parsed) ? parsed : Date.now();
  return Math.floor(value / bucketMs) * bucketMs;
}

export function getAlertPerformance() {
  pruneUnusableHistoricalAlertBacktests();
  seedHistoricalAlertBacktests();
  refreshAlertOutcomes();
  const records = listRecords();
  const byType = new Map<string, AlertBacktestRecord[]>();
  for (const record of records) byType.set(record.alertType, [...(byType.get(record.alertType) ?? []), record]);
  const knownRecords = records.filter((record) => record.outcome !== "unknown");
  const precisionByAlertType = [...byType.entries()].map(([alertType, items]) => {
    const known = items.filter((item) => item.outcome !== "unknown");
    const good = known.filter((item) => item.outcome === "good").length;
    const bad = known.filter((item) => item.outcome === "bad").length;
    const returns = known.map((item) => item.priceAtFire && item.priceAfter1h ? (item.priceAfter1h - item.priceAtFire) / item.priceAtFire : 0);
    return {
      alertType,
      count: items.length,
      knownOutcomes: known.length,
      precision: known.length ? good / known.length : null,
      falsePositiveRate: known.length ? bad / known.length : null,
      averageReturnAfter1h: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null
    };
  });
  return {
    totalAlertsTracked: records.length,
    knownOutcomes: knownRecords.length,
    unknownOutcomes: records.length - knownRecords.length,
    outcomeCoverage: records.length ? knownRecords.length / records.length : null,
    precisionByAlertType,
    falsePositiveRate: precisionByAlertType.length ? avg(precisionByAlertType.map((item) => item.falsePositiveRate).filter((item): item is number => item !== null)) : null,
    averageReturnAfterAlert: precisionByAlertType.length ? avg(precisionByAlertType.map((item) => item.averageReturnAfter1h).filter((item): item is number => item !== null)) : null,
    bestAlertCategories: precisionByAlertType.slice().sort((a, b) => (b.precision ?? -1) - (a.precision ?? -1)).slice(0, 5),
    worstAlertCategories: precisionByAlertType.slice().sort((a, b) => (a.precision ?? 2) - (b.precision ?? 2)).slice(0, 5)
  };
}

function pruneUnusableHistoricalAlertBacktests(limit = 1_000) {
  ensureAlertBacktestSchema();
  const db = getDatabase();
  const rows = db.prepare(`
    select alert_id, token_address, fired_at
    from alert_backtest_records
    where outcome = 'unknown' and alert_id like 'historical-%'
    limit ?
  `).all(Math.max(1, Math.min(limit, 5_000))) as Array<{ alert_id: string; token_address: string; fired_at: string }>;
  const remove = db.prepare("delete from alert_backtest_records where alert_id = ?");
  for (const row of rows) {
    const firedMs = new Date(row.fired_at).getTime();
    const followup = Number.isFinite(firedMs)
      ? findNearestMarketSnapshot(row.token_address, new Date(firedMs + 60 * 60_000).toISOString(), "after", 90 * 60_000)
      : undefined;
    if (!followup) remove.run(row.alert_id);
  }
}

export function seedHistoricalAlertBacktests(limit = 5_000) {
  ensureAlertBacktestSchema();
  const db = getDatabase();
  const cutoff = new Date(Date.now() - 65 * 60_000).toISOString();
  const rows = db.prepare(`
    select token_address, pair_address, observed_at, price_usd, liquidity_usd, volume_1h, volume_24h,
      buys_5m, sells_5m
    from token_market_snapshots
    where observed_at <= ? and price_usd is not null
    order by observed_at asc
    limit ?
  `).all(cutoff, Math.max(100, Math.min(limit, 5_000))) as HistoricalAlertCandidate[];

  for (const row of rows) {
    const firedMs = new Date(row.observed_at).getTime();
    if (!Number.isFinite(firedMs)) continue;
    const hasOneHourFollowup = Boolean(findNearestMarketSnapshot(row.token_address, new Date(firedMs + 60 * 60_000).toISOString(), "after", 90 * 60_000));
    if (!hasOneHourFollowup) continue;
    const alerts = historicalAlertTypes(row);
    for (const alertType of alerts) {
      const pair = row.pair_address?.toLowerCase() || "unknown-pair";
      insertRecord(`historical-${alertType}-${row.token_address.toLowerCase()}-${pair}-${alertBucket(row.observed_at)}`, {
        token: row.token_address.toLowerCase(),
        alertType,
        firedAt: row.observed_at,
        priceAtFire: row.price_usd,
        liquidityAtFire: row.liquidity_usd,
        volumeAtFire: row.volume_24h,
        priceAfter5m: null,
        priceAfter1h: null,
        priceAfter24h: null,
        maxDrawdownAfter1h: null,
        maxUpsideAfter1h: null,
        outcome: "unknown"
      });
    }
  }
}

export function refreshAlertOutcomes(limit = 250) {
  ensureAlertBacktestSchema();
  const db = getDatabase();
  const rows = db.prepare(`
    select alert_id, token_address, alert_type, fired_at, price_at_fire
    from alert_backtest_records
    where outcome = 'unknown'
    order by fired_at asc
    limit ?
  `).all(Math.max(1, Math.min(limit, 1_000))) as Array<{
    alert_id: string;
    token_address: string;
    alert_type: string;
    fired_at: string;
    price_at_fire: number | null;
  }>;
  const update = db.prepare(`
    update alert_backtest_records
    set price_after_5m = ?, price_after_1h = ?, price_after_24h = ?,
      max_drawdown_after_1h = ?, max_upside_after_1h = ?, outcome = ?, updated_at = ?
    where alert_id = ?
  `);
  for (const row of rows) {
    const firedMs = new Date(row.fired_at).getTime();
    if (!Number.isFinite(firedMs)) continue;
    const nowMs = Date.now();
    const five = nowMs >= firedMs + 5 * 60_000 ? findNearestMarketSnapshot(row.token_address, new Date(firedMs + 5 * 60_000).toISOString(), "after", 20 * 60_000) : undefined;
    const hour = nowMs >= firedMs + 60 * 60_000 ? findNearestMarketSnapshot(row.token_address, new Date(firedMs + 60 * 60_000).toISOString(), "after", 90 * 60_000) : undefined;
    const day = nowMs >= firedMs + 24 * 60 * 60_000 ? findNearestMarketSnapshot(row.token_address, new Date(firedMs + 24 * 60 * 60_000).toISOString(), "after", 6 * 60 * 60_000) : undefined;
    const basePrice = row.price_at_fire;
    const oneHourPrices = nowMs >= firedMs + 60 * 60_000 ? getMarketPricesBetween(row.token_address, row.fired_at, new Date(firedMs + 60 * 60_000).toISOString()) : [];
    const drawdown = basePrice && oneHourPrices.length ? (Math.min(...oneHourPrices) - basePrice) / basePrice : null;
    const upside = basePrice && oneHourPrices.length ? (Math.max(...oneHourPrices) - basePrice) / basePrice : null;
    const outcome = classifyAlertOutcome(row.alert_type, basePrice, hour?.price_usd ?? null, upside, drawdown);
    if (!five && !hour && !day && outcome === "unknown") continue;
    update.run(five?.price_usd ?? null, hour?.price_usd ?? null, day?.price_usd ?? null, drawdown, upside, outcome, new Date().toISOString(), row.alert_id);
  }
}

function historicalAlertTypes(row: HistoricalAlertCandidate) {
  const alerts: string[] = [];
  const volume1h = finite(row.volume_1h);
  const volume24h = finite(row.volume_24h);
  const liquidity = finite(row.liquidity_usd);
  const buys5m = finite(row.buys_5m) ?? 0;
  const sells5m = finite(row.sells_5m) ?? 0;
  const total5m = buys5m + sells5m;
  const buyPressure = total5m ? (buys5m - sells5m) / total5m : 0;
  const volumeSpike = volume1h !== null && volume24h !== null ? volume1h / Math.max(volume24h / 24, 1) : 0;
  if (volumeSpike > 2.8) alerts.push("volume_spike");
  if (buyPressure > 0.32 && buys5m > 20) alerts.push("buy_pressure_spike");
  if (liquidity !== null && volume24h !== null && liquidity / Math.max(volume24h, 1) < 0.08 && volume24h > 100_000) alerts.push("liquidity_drop");
  if (liquidity !== null && liquidity < 50_000) alerts.push("high_risk_low_liquidity");
  return alerts;
}

function insertRecord(alertId: string, record: AlertBacktestRecord) {
  ensureAlertBacktestSchema();
  getDatabase().prepare(`
    insert or ignore into alert_backtest_records (
      alert_id, token_address, alert_type, fired_at, price_at_fire, liquidity_at_fire, volume_at_fire,
      price_after_5m, price_after_1h, price_after_24h, max_drawdown_after_1h, max_upside_after_1h, outcome, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alertId,
    record.token.toLowerCase(),
    record.alertType,
    record.firedAt,
    record.priceAtFire,
    record.liquidityAtFire,
    record.volumeAtFire,
    record.priceAfter5m,
    record.priceAfter1h,
    record.priceAfter24h,
    record.maxDrawdownAfter1h,
    record.maxUpsideAfter1h,
    record.outcome,
    new Date().toISOString()
  );
}

function listRecords(limit = 2_000): AlertBacktestRecord[] {
  ensureAlertBacktestSchema();
  const rows = getDatabase().prepare(`
    select token_address, alert_type, fired_at, price_at_fire, liquidity_at_fire, volume_at_fire,
      price_after_5m, price_after_1h, price_after_24h, max_drawdown_after_1h, max_upside_after_1h, outcome
    from alert_backtest_records
    order by fired_at desc
    limit ?
  `).all(limit) as Array<{
    token_address: string;
    alert_type: string;
    fired_at: string;
    price_at_fire: number | null;
    liquidity_at_fire: number | null;
    volume_at_fire: number | null;
    price_after_5m: number | null;
    price_after_1h: number | null;
    price_after_24h: number | null;
    max_drawdown_after_1h: number | null;
    max_upside_after_1h: number | null;
    outcome: AlertBacktestRecord["outcome"];
  }>;
  return rows.map((row) => ({
    token: row.token_address,
    alertType: row.alert_type,
    firedAt: row.fired_at,
    priceAtFire: row.price_at_fire,
    liquidityAtFire: row.liquidity_at_fire,
    volumeAtFire: row.volume_at_fire,
    priceAfter5m: row.price_after_5m,
    priceAfter1h: row.price_after_1h,
    priceAfter24h: row.price_after_24h,
    maxDrawdownAfter1h: row.max_drawdown_after_1h,
    maxUpsideAfter1h: row.max_upside_after_1h,
    outcome: row.outcome
  }));
}

function ensureAlertBacktestSchema() {
  getDatabase().exec(`
    create table if not exists alert_backtest_records (
      alert_id text primary key,
      token_address text not null,
      alert_type text not null,
      fired_at text not null,
      price_at_fire real,
      liquidity_at_fire real,
      volume_at_fire real,
      price_after_5m real,
      price_after_1h real,
      price_after_24h real,
      max_drawdown_after_1h real,
      max_upside_after_1h real,
      outcome text not null default 'unknown',
      updated_at text not null
    );
    create index if not exists idx_alert_backtest_type
      on alert_backtest_records(alert_type, fired_at desc);
    create index if not exists idx_alert_backtest_outcome
      on alert_backtest_records(outcome, fired_at desc);
  `);
}

function findNearestMarketSnapshot(tokenAddress: string, targetTime: string, direction: "before" | "after", maxSkewMs?: number) {
  const op = direction === "before" ? "<=" : ">=";
  const order = direction === "before" ? "desc" : "asc";
  const row = getDatabase().prepare(`
    select price_usd, liquidity_usd, volume_24h, observed_at
    from token_market_snapshots
    where token_address = ? and observed_at ${op} ? and price_usd is not null
    order by observed_at ${order}
    limit 1
  `).get(tokenAddress.toLowerCase(), targetTime) as { price_usd: number | null; liquidity_usd: number | null; volume_24h: number | null; observed_at: string } | undefined;
  if (!row || !maxSkewMs) return row;
  const targetMs = new Date(targetTime).getTime();
  const observedMs = new Date(row.observed_at).getTime();
  return Number.isFinite(targetMs) && Number.isFinite(observedMs) && Math.abs(observedMs - targetMs) <= maxSkewMs ? row : undefined;
}

function getMarketPricesBetween(tokenAddress: string, start: string, end: string) {
  const rows = getDatabase().prepare(`
    select price_usd
    from token_market_snapshots
    where token_address = ? and observed_at >= ? and observed_at <= ? and price_usd is not null
  `).all(tokenAddress.toLowerCase(), start, end) as Array<{ price_usd: number | null }>;
  return rows.map((row) => row.price_usd).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function classifyAlertOutcome(alertType: string, priceAtFire: number | null, priceAfter1h: number | null, maxUpsideAfter1h: number | null, maxDrawdownAfter1h: number | null): AlertBacktestRecord["outcome"] {
  if (!priceAtFire || !priceAfter1h) return "unknown";
  const oneHourReturn = (priceAfter1h - priceAtFire) / priceAtFire;
  if (alertType === "liquidity_drop" || alertType === "high_risk_low_liquidity") {
    if (oneHourReturn <= -0.03 || (maxDrawdownAfter1h ?? 0) <= -0.06) return "good";
    if (oneHourReturn >= 0.08 && (maxDrawdownAfter1h ?? 0) > -0.03) return "bad";
    return "neutral";
  }
  if (oneHourReturn >= 0.03 || (maxUpsideAfter1h ?? 0) >= 0.07) return "good";
  if (oneHourReturn <= -0.05 || (maxDrawdownAfter1h ?? 0) <= -0.08) return "bad";
  return "neutral";
}

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
