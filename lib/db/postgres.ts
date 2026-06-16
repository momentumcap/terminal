import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { TokenAnalysis } from "@/lib/analysis/types";
import { postgresSchema } from "@/lib/db/schema";
import type { OnchainComponentName, OnchainComponentSnapshot } from "@/lib/db/repository";

type Confidence = "high" | "medium" | "low";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let ensureSchemaPromise: Promise<void> | null = null;

export function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL?.startsWith("postgres"));
}

function getSql() {
  if (!isPostgresConfigured()) return null;
  sqlClient = sqlClient ?? neon(process.env.DATABASE_URL!);
  return sqlClient;
}

async function ensurePostgresSchema() {
  const sql = getSql();
  if (!sql) return;
  ensureSchemaPromise = ensureSchemaPromise ?? sql.query(postgresSchema).then(() => undefined);
  await ensureSchemaPromise;
}

export async function persistAnalysisSnapshotPostgres(analysis: TokenAnalysis): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await ensurePostgresSchema();
    await sql.query(
      `insert into analysis_snapshots (
        chain_id, token_address, symbol, name, observed_at,
        data_quality_json, trusted_scores_json, trusted_metrics_json, payload_json
      ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)`,
      [
        analysis.chainId,
        analysis.address.toLowerCase(),
        analysis.symbol,
        analysis.name,
        analysis.updatedAt || new Date().toISOString(),
        JSON.stringify(analysis.dataQuality ?? null),
        JSON.stringify(analysis.trustedScores ?? null),
        JSON.stringify(analysis.trustedMetrics ?? null),
        JSON.stringify(analysis)
      ]
    );
  } catch {
    // Postgres persistence is a durability enhancement. A write failure should
    // never hide live provider data from the user.
  }
}

export async function readLatestAnalysisSnapshotPostgres(tokenAddress: string, maxAgeMs = 5 * 60_000): Promise<TokenAnalysis | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    await ensurePostgresSchema();
    const rows = await sql.query(
      `select payload_json, observed_at
       from analysis_snapshots
       where token_address = $1
       order by observed_at desc
       limit 1`,
      [tokenAddress.toLowerCase()]
    ) as Array<{ payload_json: TokenAnalysis | string; observed_at: string | Date }>;
    const row = rows[0];
    if (!row) return null;
    const observedMs = new Date(row.observed_at).getTime();
    if (!Number.isFinite(observedMs) || Date.now() - observedMs > maxAgeMs) return null;
    return typeof row.payload_json === "string" ? JSON.parse(row.payload_json) as TokenAnalysis : row.payload_json;
  } catch {
    return null;
  }
}

export async function persistOnchainComponentSnapshotPostgres<T>(input: {
  tokenAddress: string;
  component: OnchainComponentName;
  payload: T | null | undefined;
  dataQuality?: unknown;
  confidence?: Confidence | null;
  observedAt?: string;
}): Promise<void> {
  if (input.payload === undefined || input.payload === null) return;
  const sql = getSql();
  if (!sql) return;
  try {
    await ensurePostgresSchema();
    await sql.query(
      `insert into onchain_component_snapshots (
        token_address, component, observed_at, confidence, data_quality_json, payload_json
      ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        input.tokenAddress.toLowerCase(),
        input.component,
        input.observedAt ?? new Date().toISOString(),
        input.confidence ?? null,
        JSON.stringify(input.dataQuality ?? null),
        JSON.stringify(input.payload)
      ]
    );
  } catch {
    // Same rule as analysis snapshots: never break live analysis on a mirror
    // write failure.
  }
}

export async function readLatestOnchainComponentSnapshotPostgres<T>(
  tokenAddress: string,
  component: OnchainComponentName,
  maxAgeMs = 24 * 60 * 60_000
): Promise<OnchainComponentSnapshot<T> | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    await ensurePostgresSchema();
    const rows = await sql.query(
      `select token_address, component, observed_at, confidence, data_quality_json, payload_json
       from onchain_component_snapshots
       where token_address = $1 and component = $2
       order by observed_at desc
       limit 1`,
      [tokenAddress.toLowerCase(), component]
    ) as Array<{
      token_address: string;
      component: OnchainComponentName;
      observed_at: string | Date;
      confidence: Confidence | null;
      data_quality_json: unknown;
      payload_json: T | string;
    }>;
    const row = rows[0];
    if (!row) return null;
    const observedAt = new Date(row.observed_at).toISOString();
    const observedMs = new Date(observedAt).getTime();
    if (!Number.isFinite(observedMs) || Date.now() - observedMs > maxAgeMs) return null;
    return {
      tokenAddress: row.token_address,
      component: row.component,
      observedAt,
      confidence: row.confidence,
      dataQuality: typeof row.data_quality_json === "string" ? JSON.parse(row.data_quality_json) : row.data_quality_json,
      payload: typeof row.payload_json === "string" ? JSON.parse(row.payload_json) as T : row.payload_json
    };
  } catch {
    return null;
  }
}
