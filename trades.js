import { Router } from 'express';
import { z } from 'zod';
import { pool, q } from '../db.js';

const num = z.preprocess(v => (v === '' || v == null ? null : Number(v)), z.number().finite().nullable());
export const Trade = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  symbol: z.string().trim().min(1).max(32).transform(s => s.toUpperCase()),
  side: z.enum(['Buy', 'Sell']),
  lots: z.coerce.number().default(0),
  entry: num.optional(),
  exit: num.optional(),
  pnl: z.coerce.number().default(0),
  fees: z.coerce.number().default(0),
  setup: z.string().max(100).default(''),
  emotion: z.string().max(30).default('Calm'),
  rating: z.coerce.number().int().min(1).max(5).default(3),
  notes: z.string().max(10000).default(''),
});

const SEL = `id, external_id, date, symbol, side, lots, entry_price AS entry, exit_price AS "exit", pnl, fees, setup, emotion, rating, notes`;
const vals = t => [t.date, t.symbol, t.side, t.lots, t.entry ?? null, t.exit ?? null, t.pnl, t.fees, t.setup, t.emotion, t.rating, t.notes];

export async function insertTrade(client, userId, t, externalId = null) {
  const r = await client.query(
    `INSERT INTO trades(user_id,external_id,date,symbol,side,lots,entry_price,exit_price,pnl,fees,setup,emotion,rating,notes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (user_id, external_id) DO NOTHING RETURNING ${SEL}`,
    [userId, externalId, ...vals(t)]);
  return r.rows[0];
}

export const tradeRoutes = Router();

tradeRoutes.get('/', async (req, res) => {
  const { rows } = await q(`SELECT ${SEL} FROM trades WHERE user_id=$1 ORDER BY date DESC, created_at DESC`, [req.userId]);
  res.json(rows);
});

tradeRoutes.post('/', async (req, res) => {
  const t = Trade.parse(req.body);
  res.status(201).json(await insertTrade(pool, req.userId, t));
});

// Bulk import (e.g. parsed CSV rows from the frontend). Max 5000 per request.
tradeRoutes.post('/bulk', async (req, res) => {
  const list = z.array(Trade).max(5000).parse(req.body);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const t of list) await insertTrade(c, req.userId, t);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  res.status(201).json({ imported: list.length });
});

tradeRoutes.put('/:id', async (req, res) => {
  const t = Trade.parse(req.body);
  const { rows } = await q(
    `UPDATE trades SET date=$1,symbol=$2,side=$3,lots=$4,entry_price=$5,exit_price=$6,pnl=$7,fees=$8,setup=$9,emotion=$10,rating=$11,notes=$12
     WHERE id=$13 AND user_id=$14 RETURNING ${SEL}`, [...vals(t), req.params.id, req.userId]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found' });
});

tradeRoutes.delete('/:id', async (req, res) => {
  const r = await q('DELETE FROM trades WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  r.rowCount ? res.status(204).end() : res.status(404).json({ error: 'Not found' });
});
