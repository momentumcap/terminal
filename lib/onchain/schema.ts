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

create table if not exists pools (
  chain_id integer not null,
  pool_address text primary key,
  protocol text not null,
  token0 text not null,
  token1 text not null,
  quote_token text,
  fee integer,
  created_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists swaps (
  chain_id integer not null,
  pool_address text not null,
  token_address text not null,
  block_number bigint not null,
  tx_hash text not null,
  log_index integer not null,
  side text not null check (side in ('buy','sell')),
  amount_token numeric,
  amount_quote numeric,
  created_at timestamptz default now(),
  primary key (tx_hash, log_index)
);

create table if not exists token_transfers (
  chain_id integer not null,
  token_address text not null,
  block_number bigint not null,
  tx_hash text not null,
  log_index integer not null,
  sender text,
  receiver text,
  amount numeric,
  created_at timestamptz default now(),
  primary key (tx_hash, log_index)
);
`;
