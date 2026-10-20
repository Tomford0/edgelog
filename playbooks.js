import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';

const Playbook = z.object({ name: z.string().trim().min(1).max(100), rules: z.array(z.string().max(300)).max(50).default([]) });
export const playbookRoutes = Router();

playbookRoutes.get('/', async (req, res) =>
  res.json((await q('SELECT id,name,rules FROM playbooks WHERE user_id=$1 ORDER BY name', [req.userId])).rows));

playbookRoutes.post('/', async (req, res) => {
  const p = Playbook.parse(req.body);
  const { rows } = await q('INSERT INTO playbooks(user_id,name,rules) VALUES($1,$2,$3) RETURNING id,name,rules',
    [req.userId, p.name, JSON.stringify(p.rules)]);
  res.status(201).json(rows[0]);
});

playbookRoutes.delete('/:id', async (req, res) => {
  const r = await q('DELETE FROM playbooks WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  r.rowCount ? res.status(204).end() : res.status(404).json({ error: 'Not found' });
});

// Learn-tab progress, e.g. {"0":true,"3":true}
export const progressRoutes = Router();
progressRoutes.get('/', async (req, res) =>
  res.json((await q('SELECT progress FROM users WHERE id=$1', [req.userId])).rows[0].progress));
progressRoutes.put('/', async (req, res) => {
  const p = z.record(z.string(), z.boolean()).parse(req.body);
  await q('UPDATE users SET progress=$1 WHERE id=$2', [JSON.stringify(p), req.userId]);
  res.json(p);
});
