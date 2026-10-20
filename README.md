# EdgeLog

A trading journal and analytics platform: trade journaling, performance dashboard, broker import and sync, strategy playbooks, and a learning section.

```
edgelog/
├── web/index.html   # Single-file frontend (works offline, stores data in the browser)
└── api/             # Node.js + Express + PostgreSQL backend (auth, trades, playbooks, MetaApi sync)
```

## Frontend
Open `web/index.html` in a browser, or host it free with GitHub Pages (Settings -> Pages -> deploy from branch, folder `/web` via a Pages workflow, or copy it to `/docs`).
Import broker history from CSV (MT4/MT5 exports supported).

## Backend
See [`api/README.md`](api/README.md) for the API reference and deployment guides (Docker, Render, AWS App Runner + RDS).

```bash
cd api
cp .env.example .env     # fill in JWT_SECRET and ENCRYPTION_KEY (openssl rand -hex 32)
docker compose up --build
```

**Never commit `.env`.** It is git-ignored.
