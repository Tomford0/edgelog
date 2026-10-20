import pg from 'pg';

pg.types.setTypeParser(1082, v => v);        // DATE -> 'YYYY-MM-DD' string
pg.types.setTypeParser(1700, v => parseFloat(v)); // NUMERIC -> number

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
export const q = (text, params) => pool.query(text, params);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  progress jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id text,
  date date NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('Buy','Sell')),
  lots numeric NOT NULL DEFAULT 0,
  entry_price numeric,
  exit_price numeric,
  pnl numeric NOT NULL DEFAULT 0,
  fees numeric NOT NULL DEFAULT 0,
  setup text NOT NULL DEFAULT '',
  emotion text NOT NULL DEFAULT 'Calm',
  rating int NOT NULL DEFAULT 3,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);
CREATE INDEX IF NOT EXISTS trades_user_date ON trades(user_id, date DESC);
CREATE TABLE IF NOT EXISTS playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  rules jsonb NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS broker_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  token_enc text NOT NULL,
  last_sync timestamptz
);`;

export const migrate = () => pool.query(SCHEMA);
