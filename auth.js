import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { q } from './db.js';

const sign = id => jwt.sign({ sub: id }, process.env.JWT_SECRET, { expiresIn: '7d' });

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    req.userId = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', process.env.JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

const Creds = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(8).max(200) });
export const authRoutes = Router();

authRoutes.post('/register', async (req, res) => {
  const { email, password } = Creds.parse(req.body);
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await q('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id', [email, hash]);
    res.status(201).json({ token: sign(rows[0].id) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
});

authRoutes.post('/login', async (req, res) => {
  const { email, password } = Creds.parse(req.body);
  const { rows } = await q('SELECT id,password_hash FROM users WHERE email=$1', [email]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(rows[0].id) });
});
