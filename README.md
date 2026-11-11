# Meridian

Life OS pessoal: finanças, objetivos, projetos, estudos e infraestrutura num só painel.

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Vercel · PWA

- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Design System: [identidade-visual/DESIGN_SYSTEM.md](identidade-visual/DESIGN_SYSTEM.md)
- Setup e deploy: [docs/SETUP.md](docs/SETUP.md)

## Desenvolvimento local

Requisitos: Node 22+, Docker Desktop.

```bash
npm install
npm run db:start
cp .env.example .env.local
npm run users:create
npm run dev
```

Preencha `.env.local` com a `Publishable` e a `Secret` key exibidas por `npm run db:start`. Os e-mails de login local chegam no Mailpit em `http://127.0.0.1:54324`.

| Script | Função |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run typecheck` / `lint` / `test` | verificações do CI |
| `npm run db:reset` | recria o banco local a partir das migrations |
| `npm run db:test` | testes pgTAP (RLS) |
| `npm run db:types` | gera os tipos TypeScript do banco |
| `npm run users:create` | cria no Auth os usuários de `ALLOWED_EMAILS` |
