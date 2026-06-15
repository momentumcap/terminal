export const sqliteSchema = `
create table if not exists tokens (
  chain_id integer not null,
  token_address text primary key,
  symbol text,
  name text,
  decimals integer,
  total_supply text,
  first_seen_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists token_market_snapshots (
  id integer primary key autoincrement,
  chain_id integer not null,
  token_address text not null,
  symbol text,
  name text,
  pair_address text,
  dex_id text,
  context text not null,
  observed_at text not null,
  price_usd real,
  market_cap real,
  fdv real,
  liquidity_usd real,
  volume_5m real,
  volume_1h real,
  volume_6h real,
  volume_24h real,
  buys_5m integer,
  sells_5m integer,
  buys_1h integer,
  sells_1h integer,
  buys_6h integer,
  sells_6h integer,
  buys_24h integer,
  sells_24h integer,
  source text,
  sources_json text not null,
  confidence text not null default 'medium',
  payload_json text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_market_token_observed
  on token_market_snapshots(token_address, observed_at desc);

create index if not exists idx_market_context_observed
  on token_market_snapshots(context, observed_at desc);

create table if not exists trusted_metric_observations (
  id integer primary key autoincrement,
  entity_type text not null,
  entity_id text not null,
  metric_key text not null,
  label text not null,
  value_json text,
  source text not null,
  sources_tried_json text not null,
  confidence text not null,
  is_estimated integer not null,
  is_stale integer not null,
  missing_fields_json text not null,
  warnings_json text not null,
  observed_at text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_metric_entity_observed
  on trusted_metric_observations(entity_type, entity_id, metric_key, observed_at desc);

create table if not exists analysis_snapshots (
  id integer primary key autoincrement,
  chain_id integer not null,
  token_address text not null,
  symbol text,
  name text,
  observed_at text not null,
  data_quality_json text not null,
  trusted_scores_json text not null,
  trusted_metrics_json text not null,
  payload_json text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_analysis_token_observed
  on analysis_snapshots(token_address, observed_at desc);

create table if not exists holder_snapshots (
  id integer primary key autoincrement,
  token_address text not null,
  observed_at text not null,
  total_holders integer,
  sampled_holder_count integer,
  top10_pct real,
  top25_pct real,
  top50_pct real,
  concentration_risk real,
  source text,
  confidence text,
  data_quality_json text not null,
  holders_json text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_holders_token_observed
  on holder_snapshots(token_address, observed_at desc);

create table if not exists token_transfer_observations (
  token_address text not null,
  tx_hash text not null,
  log_index integer not null,
  block_number integer not null,
  from_address text not null,
  to_address text not null,
  value_raw text not null,
  observed_at text not null,
  primary key (token_address, tx_hash, log_index)
);

create index if not exists idx_transfer_token_block
  on token_transfer_observations(token_address, block_number desc);

create index if not exists idx_transfer_wallet
  on token_transfer_observations(from_address, to_address);

create table if not exists wallet_token_observations (
  token_address text not null,
  wallet_address text not null,
  first_seen_block integer not null,
  last_seen_block integer not null,
  in_count integer not null,
  out_count integer not null,
  received_raw text not null,
  sent_raw text not null,
  net_raw text not null,
  updated_at text not null,
  primary key (token_address, wallet_address)
);

create index if not exists idx_wallet_token_last_seen
  on wallet_token_observations(token_address, last_seen_block desc);

create table if not exists holder_indexer_runs (
  id integer primary key autoincrement,
  token_address text not null,
  from_block integer not null,
  to_block integer not null,
  transfer_count integer not null,
  wallet_count integer not null,
  status text not null,
  warnings_json text not null,
  started_at text not null,
  finished_at text not null
);

create index if not exists idx_indexer_runs_token
  on holder_indexer_runs(token_address, finished_at desc);

create table if not exists tracked_indexer_tokens (
  token_address text primary key,
  symbol text,
  name text,
  reason text not null,
  priority integer not null default 50,
  enabled integer not null default 1,
  last_indexed_at text,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_tracked_indexer_tokens_next
  on tracked_indexer_tokens(enabled, priority desc, last_indexed_at asc);

create table if not exists wallet_intelligence_events (
  id text primary key,
  token_address text not null,
  type text not null,
  severity text not null,
  message text not null,
  metrics_json text not null,
  created_at text not null
);

create index if not exists idx_wallet_intel_events_token
  on wallet_intelligence_events(token_address, created_at desc);

create index if not exists idx_wallet_intel_events_created
  on wallet_intelligence_events(created_at desc);

create table if not exists wallet_event_performance (
  event_id text primary key,
  token_address text not null,
  event_type text not null,
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

create index if not exists idx_wallet_event_performance_token
  on wallet_event_performance(token_address, fired_at desc);

create index if not exists idx_wallet_event_performance_outcome
  on wallet_event_performance(outcome, fired_at desc);

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

create table if not exists bankr_launches (
  token_address text primary key,
  chain_id integer not null,
  token_name text,
  token_symbol text,
  creator_handle text,
  launched_at text,
  last_seen_at text not null,
  credibility_score real,
  launch_quality_score real,
  risk_score real,
  opportunity_score real,
  verdict text,
  data_quality_json text not null,
  payload_json text not null
);

create index if not exists idx_bankr_launched_at
  on bankr_launches(launched_at desc);

create table if not exists provider_observations (
  id integer primary key autoincrement,
  provider text not null,
  status text not null,
  latency_ms integer,
  latest_block integer,
  configured integer not null,
  last_error text,
  observed_at text not null,
  payload_json text not null
);

create index if not exists idx_provider_observed
  on provider_observations(provider, observed_at desc);

create table if not exists cache_telemetry_events (
  id integer primary key autoincrement,
  namespace text not null,
  cache_key text not null,
  event_type text not null,
  ttl_ms integer,
  cache_age_ms integer,
  observed_at text not null
);

create index if not exists idx_cache_telemetry_observed
  on cache_telemetry_events(observed_at desc);

create index if not exists idx_cache_telemetry_namespace
  on cache_telemetry_events(namespace, observed_at desc);

create table if not exists beta_feedback_reports (
  id text primary key,
  category text not null,
  severity text not null,
  token_address text,
  page_url text,
  title text not null,
  details text not null,
  expected_result text,
  steps_to_reproduce text,
  contact text,
  status text not null default 'open',
  user_agent text,
  context_json text not null,
  created_at text not null
);

create index if not exists idx_beta_feedback_created
  on beta_feedback_reports(created_at desc);

create index if not exists idx_beta_feedback_status
  on beta_feedback_reports(status, created_at desc);
`;

export const postgresSchema = `
create table if not exists tokens (
  chain_id integer not null,
  token_address text primary key,
  symbol text,
  name text,
  decimals integer,
  total_supply numeric,
  first_seen_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists token_market_snapshots (
  id bigserial primary key,
  chain_id integer not null,
  token_address text not null,
  symbol text,
  name text,
  pair_address text,
  dex_id text,
  context text not null,
  observed_at timestamptz not null,
  price_usd numeric,
  market_cap numeric,
  fdv numeric,
  liquidity_usd numeric,
  volume_5m numeric,
  volume_1h numeric,
  volume_6h numeric,
  volume_24h numeric,
  buys_5m integer,
  sells_5m integer,
  buys_1h integer,
  sells_1h integer,
  buys_6h integer,
  sells_6h integer,
  buys_24h integer,
  sells_24h integer,
  source text,
  sources_json jsonb not null,
  confidence text not null default 'medium',
  payload_json jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_market_token_observed on token_market_snapshots(token_address, observed_at desc);
create index if not exists idx_market_context_observed on token_market_snapshots(context, observed_at desc);

create table if not exists trusted_metric_observations (
  id bigserial primary key,
  entity_type text not null,
  entity_id text not null,
  metric_key text not null,
  label text not null,
  value_json jsonb,
  source text not null,
  sources_tried_json jsonb not null,
  confidence text not null,
  is_estimated boolean not null,
  is_stale boolean not null,
  missing_fields_json jsonb not null,
  warnings_json jsonb not null,
  observed_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_metric_entity_observed on trusted_metric_observations(entity_type, entity_id, metric_key, observed_at desc);

create table if not exists analysis_snapshots (
  id bigserial primary key,
  chain_id integer not null,
  token_address text not null,
  symbol text,
  name text,
  observed_at timestamptz not null,
  data_quality_json jsonb not null,
  trusted_scores_json jsonb not null,
  trusted_metrics_json jsonb not null,
  payload_json jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_analysis_token_observed on analysis_snapshots(token_address, observed_at desc);

create table if not exists holder_snapshots (
  id bigserial primary key,
  token_address text not null,
  observed_at timestamptz not null,
  total_holders integer,
  sampled_holder_count integer,
  top10_pct numeric,
  top25_pct numeric,
  top50_pct numeric,
  concentration_risk numeric,
  source text,
  confidence text,
  data_quality_json jsonb not null,
  holders_json jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_holders_token_observed on holder_snapshots(token_address, observed_at desc);

create table if not exists token_transfer_observations (
  token_address text not null,
  tx_hash text not null,
  log_index integer not null,
  block_number bigint not null,
  from_address text not null,
  to_address text not null,
  value_raw numeric not null,
  observed_at timestamptz not null,
  primary key (token_address, tx_hash, log_index)
);

create index if not exists idx_transfer_token_block on token_transfer_observations(token_address, block_number desc);
create index if not exists idx_transfer_wallet on token_transfer_observations(from_address, to_address);

create table if not exists wallet_token_observations (
  token_address text not null,
  wallet_address text not null,
  first_seen_block bigint not null,
  last_seen_block bigint not null,
  in_count integer not null,
  out_count integer not null,
  received_raw numeric not null,
  sent_raw numeric not null,
  net_raw numeric not null,
  updated_at timestamptz not null,
  primary key (token_address, wallet_address)
);

create index if not exists idx_wallet_token_last_seen on wallet_token_observations(token_address, last_seen_block desc);

create table if not exists holder_indexer_runs (
  id bigserial primary key,
  token_address text not null,
  from_block bigint not null,
  to_block bigint not null,
  transfer_count integer not null,
  wallet_count integer not null,
  status text not null,
  warnings_json jsonb not null,
  started_at timestamptz not null,
  finished_at timestamptz not null
);

create index if not exists idx_indexer_runs_token on holder_indexer_runs(token_address, finished_at desc);

create table if not exists tracked_indexer_tokens (
  token_address text primary key,
  symbol text,
  name text,
  reason text not null,
  priority integer not null default 50,
  enabled boolean not null default true,
  last_indexed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_tracked_indexer_tokens_next
  on tracked_indexer_tokens(enabled, priority desc, last_indexed_at asc);

create table if not exists wallet_intelligence_events (
  id text primary key,
  token_address text not null,
  type text not null,
  severity text not null,
  message text not null,
  metrics_json jsonb not null,
  created_at timestamptz not null
);

create index if not exists idx_wallet_intel_events_token
  on wallet_intelligence_events(token_address, created_at desc);

create index if not exists idx_wallet_intel_events_created
  on wallet_intelligence_events(created_at desc);

create table if not exists wallet_event_performance (
  event_id text primary key,
  token_address text not null,
  event_type text not null,
  fired_at timestamptz not null,
  price_at_fire numeric,
  liquidity_at_fire numeric,
  volume_at_fire numeric,
  price_after_5m numeric,
  price_after_1h numeric,
  price_after_24h numeric,
  max_drawdown_after_1h numeric,
  max_upside_after_1h numeric,
  outcome text not null default 'unknown',
  updated_at timestamptz not null
);

create index if not exists idx_wallet_event_performance_token
  on wallet_event_performance(token_address, fired_at desc);

create index if not exists idx_wallet_event_performance_outcome
  on wallet_event_performance(outcome, fired_at desc);

create table if not exists alert_backtest_records (
  alert_id text primary key,
  token_address text not null,
  alert_type text not null,
  fired_at timestamptz not null,
  price_at_fire numeric,
  liquidity_at_fire numeric,
  volume_at_fire numeric,
  price_after_5m numeric,
  price_after_1h numeric,
  price_after_24h numeric,
  max_drawdown_after_1h numeric,
  max_upside_after_1h numeric,
  outcome text not null default 'unknown',
  updated_at timestamptz not null
);

create index if not exists idx_alert_backtest_type
  on alert_backtest_records(alert_type, fired_at desc);

create index if not exists idx_alert_backtest_outcome
  on alert_backtest_records(outcome, fired_at desc);

create table if not exists bankr_launches (
  token_address text primary key,
  chain_id integer not null,
  token_name text,
  token_symbol text,
  creator_handle text,
  launched_at timestamptz,
  last_seen_at timestamptz not null,
  credibility_score numeric,
  launch_quality_score numeric,
  risk_score numeric,
  opportunity_score numeric,
  verdict text,
  data_quality_json jsonb not null,
  payload_json jsonb not null
);

create index if not exists idx_bankr_launched_at on bankr_launches(launched_at desc);

create table if not exists provider_observations (
  id bigserial primary key,
  provider text not null,
  status text not null,
  latency_ms integer,
  latest_block bigint,
  configured boolean not null,
  last_error text,
  observed_at timestamptz not null,
  payload_json jsonb not null
);

create index if not exists idx_provider_observed on provider_observations(provider, observed_at desc);

create table if not exists cache_telemetry_events (
  id bigserial primary key,
  namespace text not null,
  cache_key text not null,
  event_type text not null,
  ttl_ms integer,
  cache_age_ms integer,
  observed_at timestamptz not null
);

create index if not exists idx_cache_telemetry_observed on cache_telemetry_events(observed_at desc);
create index if not exists idx_cache_telemetry_namespace on cache_telemetry_events(namespace, observed_at desc);

create table if not exists beta_feedback_reports (
  id text primary key,
  category text not null,
  severity text not null,
  token_address text,
  page_url text,
  title text not null,
  details text not null,
  expected_result text,
  steps_to_reproduce text,
  contact text,
  status text not null default 'open',
  user_agent text,
  context_json jsonb not null,
  created_at timestamptz not null
);

create index if not exists idx_beta_feedback_created on beta_feedback_reports(created_at desc);
create index if not exists idx_beta_feedback_status on beta_feedback_reports(status, created_at desc);
`;
