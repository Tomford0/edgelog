import { Router } from 'express';
import { z } from 'zod';
import { pool, q } from '../db.js';
import { encrypt, decrypt } from '../crypto.js';
import { fetchClosedTrades } from '../metaapi.js';
import { insertTrade, Trade } from './trades.js';

export async function syncUser(userId) {
  const { rows } = await q('SELECT account_id, token_enc, last_sync FROM broker_accounts WHERE user_id=$1', [userId]);
  if (!rows[0]) throw Object.assign(new Error('No broker connected'), { status: 400 });
  const now = new Date();
  const from = rows[0].last_sync ? new Date(rows[0].last_sync.getTime() - 24 * 3600e3) : new Date(now - 90 * 24 * 3600e3);
  const items = await fetchClosedTrades(rows[0].account_id, decrypt(rows[0].token_enc), from, now);
  let added = 0;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const { externalId, trade } of items)
      if (await insertTrade(c, userId, Trade.parse(trade), externalId)) added++;
    await c.query('UPDATE broker_accounts SET last_sync=$1 WHERE user_id=$2', [now, userId]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  return { fetched: items.length, added };
}

export async function syncAll() {
  const { rows } = await q('SELECT user_id FROM broker_accounts');
  for (const r of rows) { try { await syncUser(r.user_id); } catch (e) { console.error('sync failed', r.user_id, e.message); } }
}

export const brokerRoutes = Router();

brokerRoutes.get('/', async (req, res) => {
  const { rows } = await q('SELECT account_id, last_sync FROM broker_accounts WHERE user_id=$1', [req.userId]);
  res.json(rows[0] ? { connected: true, accountId: rows[0].account_id, lastSync: rows[0].last_sync } : { connected: false });
});

brokerRoutes.post('/connect', async (req, res) => {
  const b = z.object({ accountId: z.string().min(1).max(100), token: z.string().min(10).max(5000) }).parse(req.body);
  await q(`INSERT INTO broker_accounts(user_id,account_id,token_enc) VALUES($1,$2,$3)
           ON CONFLICT (user_id) DO UPDATE SET account_id=EXCLUDED.account_id, token_enc=EXCLUDED.token_enc, last_sync=NULL`,
    [req.userId, b.accountId, encrypt(b.token)]);
  res.status(201).json({ connected: true });
});

brokerRoutes.post('/sync', async (req, res) => res.json(await syncUser(req.userId)));

brokerRoutes.delete('/', async (req, res) => {
  await q('DELETE FROM broker_accounts WHERE user_id=$1', [req.userId]);
  res.status(204).end();
});
