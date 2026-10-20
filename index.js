import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { migrate, pool } from './db.js';
import { authRoutes, requireAuth } from './auth.js';
import { tradeRoutes } from './routes/trades.js';
import { playbookRoutes, progressRoutes } from './routes/playbooks.js';
import { brokerRoutes, syncAll } from './routes/broker.js';

for (const k of ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'])
  if (!process.env[k]) { console.error(`Missing env var ${k}`); process.exit(1); }
if (!/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) { console.error('ENCRYPTION_KEY must be 64 hex chars'); process.exit(1); }

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean) }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60e3, limit: 30 }), authRoutes);
app.use('/api/trades', requireAuth, tradeRoutes);
app.use('/api/playbooks', requireAuth, playbookRoutes);
app.use('/api/progress', requireAuth, progressRoutes);
app.use('/api/broker', requireAuth, brokerRoutes);

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid input', details: err.issues });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

await migrate();
const server = app.listen(process.env.PORT || 8080, () => console.log('EdgeLog API listening'));
if (process.env.AUTO_SYNC === 'true') setInterval(() => syncAll().catch(console.error), 15 * 60e3);
process.on('SIGTERM', () => server.close(() => pool.end()));
