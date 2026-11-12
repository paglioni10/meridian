# Meridian · Roadmap de Execução

Plano técnico em 10 fases (F0–F9). Cada fase termina com um deploy em produção na Vercel e só avança quando todos os critérios de aceite estiverem verdes.

Fonte de verdade visual: `identidade-visual/DESIGN_SYSTEM.md`, `tokens.css`, `tailwind.config.js`, `theme-*.css`, `logo/`.

---

## Visão geral

| Fase | Entrega | Depende de | Estimativa |
|---|---|---|---|
| F0 | Fundação: repositório, Supabase, Auth, RLS, CI/CD, backup | — | 3–4 dias |
| F1 | App Shell, Design System em código, tema, alternador de contexto | F0 | 4–5 dias |
| F2 | Backlog de Cursos + deep links Obsidian | F1 | 2–3 dias |
| F3 | Finanças · Ganhos (CLT × PJ, base segura, histórico) | F1 | 4–5 dias |
| F4 | Finanças · Despesas + importação Nubank (OFX/CSV) | F3 | 6–8 dias |
| F5 | Trilha de Objetivos | F3 | 3–4 dias |
| F6 | Projetos & Pipeline Freelance (Kanban + CRM) | F1, F3 | 5–6 dias |
| F7 | Central de Infraestrutura (monitoramento + vencimentos) | F1 | 4–5 dias |
| F8 | Quick Capture completo + Visão Geral | F2–F7 | 4–5 dias |
| F9 | PWA, offline, APK (TWA), hardening e release 1.0 | F8 | 4–5 dias |

```
F0 ─ F1 ─┬─ F2 ───────────────┐
         ├─ F3 ─┬─ F4 ────────┤
         │      ├─ F5 ────────┼─ F8 ─ F9
         │      └─ F6 ────────┤
         └─ F7 ───────────────┘
```

F2, F7 e o bloco F3→(F4, F5, F6) podem correr em paralelo após F1.

---

## Decisões de arquitetura transversais

| Tema | Decisão |
|---|---|
| Usuário | Single-tenant com Supabase Auth (magic link + e-mail allowlist). Cadastro público desativado no painel do Supabase. Todas as tabelas têm `user_id` + RLS, deixando o app pronto para multiusuário sem refatoração. |
| Dinheiro | `bigint` em centavos (`*_cents`). Formatação pt-BR só na borda (`Intl.NumberFormat('pt-BR')`). Nunca `float`. |
| Datas | `date` para competência/ocorrência, `timestamptz` para eventos. Fuso fixo `America/Sao_Paulo` na formatação. |
| Contexto | Enum `context_kind` (`personal`, `work`, `freelance`) em toda entidade filtrável. Contexto ativo em cookie, lido no servidor. |
| Mutations | Server Actions para CRUD de UI. Route Handlers apenas para upload, cron, webhooks e heartbeat. |
| Leitura | React Server Components com `@supabase/ssr`. Agregações em views `security_invoker` e funções SQL, nunca no cliente. |
| Validação | Zod compartilhado entre form (`react-hook-form`) e Server Action. |
| Migrations | Supabase CLI (`supabase/migrations/*.sql`), tipos gerados com `supabase gen types typescript`. Nada de alteração manual no painel. |
| Gráficos | Componentes SVG próprios (linha/barra 1px, `--ink`/`--blue`/`--red`), conforme regra do DS. Sem lib de chart pesada. |
| VPS própria | Hetzner com n8n já existente. Não hospeda o Meridian; serve como alvo monitorado, canal de alertas e watchdog externo (F7). |
| Agendamentos | `pg_cron` + `pg_net` no Supabase (gratuito, sem limite de minutos) chamando Route Handlers protegidos por `CRON_SECRET`. O tráfego gerado também evita a pausa por inatividade do Free Tier. |
| Testes | Vitest (parsers, cálculos, utils), Playwright (E2E por módulo), testes de RLS com dois usuários no Supabase local. |
| Tailwind | **Resolvido.** Tailwind v4 carregando o `tailwind.config.js` (v3) via `@config`. Classes reutilizadas em `@apply` viram `@utility`. Migração para `@theme` só se houver ganho. |
| Ícone PWA | **Resolvido.** Ícones vêm exclusivamente de `logo/`; DS atualizado. |
| Repositório | Público em `github.com/paglioni10/meridian`. Nenhum segredo, e-mail ou dado pessoal versionado; tudo em variáveis da Vercel/GitHub Secrets. |
| Pacotes | `npm` (Node 26 não traz corepack/pnpm). Supabase CLI como devDependency (`npx supabase`). |

### Estrutura de pastas

```
meridian/
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (app)/layout.tsx
│  ├─ (app)/page.tsx
│  ├─ (app)/cursos/
│  ├─ (app)/financas/ganhos/
│  ├─ (app)/financas/despesas/
│  ├─ (app)/financas/importar/
│  ├─ (app)/objetivos/
│  ├─ (app)/projetos/
│  ├─ (app)/freelance/
│  ├─ (app)/infra/
│  ├─ (app)/ajustes/
│  ├─ api/import/nubank/route.ts
│  ├─ api/cron/[job]/route.ts
│  ├─ api/heartbeat/[token]/route.ts
│  ├─ auth/callback/route.ts
│  ├─ manifest.ts
│  └─ globals.css
├─ components/ui/
├─ components/charts/
├─ components/shell/
├─ features/<modulo>/{actions.ts,queries.ts,schema.ts,components/}
├─ lib/supabase/{server.ts,client.ts,admin.ts,middleware.ts}
├─ lib/{money.ts,dates.ts,context.ts,obsidian.ts}
├─ lib/parsers/{ofx.ts,nubank-csv.ts,normalize.ts,hash.ts}
├─ supabase/migrations/
├─ supabase/seed.sql
├─ tests/{unit,e2e,rls}/
└─ middleware.ts
```

### SQL base reutilizado por todas as fases

```sql
create extension if not exists pgcrypto;

create type context_kind as enum ('personal', 'work', 'freelance');
create type priority_level as enum ('low', 'medium', 'high', 'critical');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Padrão aplicado a cada tabela `X`:

```sql
alter table X enable row level security;

create policy "owner_all" on X
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger X_updated_at
  before update on X
  for each row execute function set_updated_at();
```

Colunas padrão de toda tabela de domínio: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.

---

## F0 · Fundação & Infraestrutura

**Objetivo:** ambiente reprodutível de ponta a ponta: código no GitHub, banco versionado, autenticação fechada, deploy automático e backup dos dados desde o primeiro dia.

### Entregáveis técnicos

**Infra**
- Repositório GitHub público, branch `main` protegida, PRs com preview deploy na Vercel.
- Projeto Next.js (App Router, TypeScript strict, ESLint, Prettier), `npm`.
- Projeto Supabase (região `sa-east-1`), Supabase CLI linkado, ambiente local via `supabase start`.
- Variáveis na Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (somente server), `CRON_SECRET`, `ALLOWED_EMAILS`.
- GitHub Actions `ci.yml`: typecheck, lint, Vitest, `supabase db lint`, build.
- GitHub Actions `backup.yml` semanal: `supabase db dump` (schema + dados) criptografado com `age` (chave pública em secret) e salvo como artifact (retenção 90 dias). Como o repositório é público, o artifact só é útil a quem tem a chave privada `age`, que nunca sai da máquina do dono. O Free Tier do Supabase não tem backup automático.

**Banco**
- Migration `0000_base.sql` com o SQL base acima.
- Auth: magic link, signup desativado, URL de redirect da Vercel e `localhost` cadastradas.

**Next.js**
- `lib/supabase/server.ts`, `client.ts`, `admin.ts` com `@supabase/ssr`.
- `middleware.ts` renovando sessão e redirecionando não autenticados para `/login`.
- `app/auth/callback/route.ts` trocando o código por sessão e validando o e-mail contra `ALLOWED_EMAILS`.

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|api/heartbeat|api/cron).*)'],
};
```

### Critérios de aceite
- Push na `main` gera deploy de produção com SSL; PR gera preview.
- Login por magic link funciona em produção; e-mail fora da allowlist é rejeitado.
- Rota protegida sem sessão redireciona para `/login`.
- `supabase db reset` local recria o banco do zero sem erro.
- CI verde; workflow de backup executado manualmente uma vez e restaurado em banco local com sucesso.

### Dependências
Nenhuma. Contas GitHub, Vercel e Supabase criadas.

---

## F1 · App Shell, Design System & Contexto

**Objetivo:** casca navegável com a identidade Meridian aplicada, tema claro/escuro persistente, alternador de contexto funcional e biblioteca de componentes base que todos os módulos vão consumir.

### Entregáveis técnicos

**Banco**

```sql
create table user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  active_context text not null default 'all' check (active_context in ('all', 'personal', 'work', 'freelance')),
  obsidian_vault text,
  safe_base_months smallint not null default 6 check (safe_base_months between 3 and 24),
  timezone text not null default 'America/Sao_Paulo',
  updated_at timestamptz not null default now()
);
```

**Next.js**
- `globals.css` importando `tokens.css`, `theme-light.css`, `theme-dark.css` e camada de componentes do DS.
- Fontes via `next/font/google`: Archivo 800, Public Sans 400/500, IBM Plex Mono 400/500.
- Script inline anti-flash no `<head>` aplicando `data-theme` antes da hidratação.
- `lib/context.ts`: leitura/escrita do cookie `meridian-ctx` + helper `applyContext(query)` para filtrar queries do Supabase.
- Server Actions: `setTheme`, `setContext`, `updateSettings`.

**Componentes**
- `components/shell/`: `Sidebar` (índice numerado, ativo em `--red`), `BottomNav` (5 destinos), `PageHead`, `ContextSwitcher` (Tudo · Pessoal · Trabalho · Freelance), `ThemeToggle`.
- `components/ui/`: `Stat`, `H2`, `Row`, `Progress`, `Tag`, `Button`, `Input`, `Select`, `Textarea`, `Dialog` (modal desktop / bottom sheet mobile), `EmptyState`, `Kbd`, `Money`, `DateMono`, `Toast`.
- Página `/ajustes` e página `/` com placeholders de seções.
- Rota `/dev/ui` (apenas em desenvolvimento) renderizando todos os componentes nos dois temas.

### Critérios de aceite
- Layout correto em 360, 768, 1024, 1280, 1920 e 2560 px conforme a tabela de grid do DS; sem scroll horizontal fora do Kanban.
- Troca de tema sem flash na recarga; primeira visita segue `prefers-color-scheme`.
- Troca de contexto persiste entre sessões e dispositivos (cookie + `user_settings`).
- Nenhum HEX em componente: `grep -rE "#[0-9a-fA-F]{3,6}" components app` retorna vazio fora dos arquivos de tema.
- Alvos de toque ≥44px e foco visível em azul verificados com navegação só por teclado.
- Lighthouse Acessibilidade ≥95 em `/`.

### Dependências
F0.

---

## F2 · Backlog de Cursos & Obsidian

**Objetivo:** primeiro módulo CRUD completo, validando o padrão (schema → actions → queries → UI → testes) que será repetido nos demais, com integração `obsidian://`.

### Entregáveis técnicos

**Banco**

```sql
create type course_status as enum ('backlog', 'in_progress', 'paused', 'done', 'dropped');

create table course_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context context_kind not null default 'personal',
  category_id uuid references course_categories on delete set null,
  title text not null check (length(title) between 1 and 200),
  url text,
  provider text,
  priority priority_level not null default 'medium',
  status course_status not null default 'backlog',
  estimated_hours numeric(6,1) check (estimated_hours > 0),
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  obsidian_note text,
  started_on date,
  finished_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_user_status_idx on courses (user_id, status, priority);
```

**Next.js**
- `features/courses/{schema.ts,actions.ts,queries.ts}`: `createCourse`, `updateCourse`, `setCourseStatus`, `deleteCourse`, `createCategory`.
- Filtro “cabe no meu tempo”: o usuário informa horas livres e a lista retorna cursos `backlog` com `estimated_hours <= horas`, ordenados por prioridade.
- `lib/obsidian.ts`:

```ts
export function obsidianUri(vault: string, file: string) {
  const params = new URLSearchParams({ vault, file });
  return `obsidian://open?${params.toString().replace(/\+/g, '%20')}`;
}
```

**Componentes**
- `CourseList` (`.row`: título | prioridade | horas | link Obsidian em mono azul), `CourseForm`, `CourseFilters` (status, categoria, prioridade, horas livres), `ObsidianLink` (desabilitado com aviso quando `obsidian_vault` não está configurado).

### Critérios de aceite
- CRUD completo com validação Zod no cliente e no servidor.
- Link Obsidian abre a nota correta no desktop (Windows) e no Android com o app instalado; caminhos com espaço, acento e subpasta testados.
- Testes unitários de `obsidianUri` cobrindo espaços, `#`, `&`, acentos e `/`.
- Teste de RLS: usuário B não lê nem altera cursos do usuário A.
- E2E Playwright: criar → filtrar → mudar status → excluir.

### Dependências
F1.

---

## F3 · Finanças · Ganhos

**Objetivo:** registrar renda separando garantida (CLT) e variável (PJ/Freelance), calcular automaticamente a base segura mensal e exibir a evolução histórica.

### Regra da base segura mensal
Considerando os últimos N meses fechados (`user_settings.safe_base_months`, padrão 6):
- **Garantida:** mediana mensal da renda `guaranteed` (absorve 13º e férias sem inflar a base).
- **Variável:** percentil 20 da renda `variable`, contando meses sem receita como zero.
- **Base segura** = garantida + variável conservadora.

### Entregáveis técnicos

**Banco**

```sql
create type income_kind as enum ('guaranteed', 'variable');

create table income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind income_kind not null,
  context context_kind not null,
  default_amount_cents bigint check (default_amount_cents > 0),
  payday smallint check (payday between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null references income_sources on delete restrict,
  kind income_kind not null,
  context context_kind not null,
  competence_month date not null check (competence_month = date_trunc('month', competence_month)::date),
  received_on date,
  gross_cents bigint check (gross_cents > 0),
  amount_cents bigint not null check (amount_cents > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incomes_user_month_idx on incomes (user_id, competence_month);

create view v_income_monthly with (security_invoker = true) as
select
  user_id,
  competence_month,
  coalesce(sum(amount_cents) filter (where kind = 'guaranteed'), 0)::bigint as guaranteed_cents,
  coalesce(sum(amount_cents) filter (where kind = 'variable'), 0)::bigint as variable_cents,
  sum(amount_cents)::bigint as total_cents
from incomes
group by user_id, competence_month;

create or replace function safe_monthly_base(p_months int default null)
returns table (guaranteed_cents bigint, variable_floor_cents bigint, safe_base_cents bigint, months_considered int)
language sql
stable
security invoker
as $$
  with cfg as (
    select coalesce(p_months, (select safe_base_months from user_settings where user_id = auth.uid()), 6) as n
  ),
  months as (
    select generate_series(
      (date_trunc('month', current_date) - make_interval(months => (select n from cfg)))::date,
      (date_trunc('month', current_date) - interval '1 month')::date,
      interval '1 month'
    )::date as m
  ),
  agg as (
    select coalesce(v.guaranteed_cents, 0) as g, coalesce(v.variable_cents, 0) as v
    from months
    left join v_income_monthly v on v.competence_month = months.m and v.user_id = auth.uid()
  )
  select
    percentile_disc(0.5) within group (order by g)::bigint,
    percentile_disc(0.2) within group (order by v)::bigint,
    (percentile_disc(0.5) within group (order by g) + percentile_disc(0.2) within group (order by v))::bigint,
    count(*)::int
  from agg;
$$;
```

**Next.js**
- `features/income/actions.ts`: `createSource`, `updateSource`, `createIncome`, `updateIncome`, `deleteIncome`, `launchFromSource` (lança o valor padrão da fonte no mês corrente com um clique).
- `features/income/queries.ts`: `getMonthlySeries(range)`, `getSafeBase()` via `supabase.rpc('safe_monthly_base')`.
- `lib/money.ts`: `parseBRL('1.234,56') → 123456`, `formatBRL(123456) → '1.234,56'`.

**Componentes**
- `/financas/ganhos`: `Stat` Base segura (Display), `Stat` CLT, `Stat` PJ, `Stat` média 12 meses.
- `IncomeTimeline` (SVG: linha total em `--ink`, garantida e variável em barras empilhadas 1px, seletor 6/12/24 meses).
- `IncomeList` (`.row` por mês, expandível), `IncomeForm`, `SourceManager`.

### Critérios de aceite
- `safe_monthly_base` testada em SQL com cenários: só CLT, só PJ, meses zerados, 13º salário, menos de N meses de histórico.
- `parseBRL`/`formatBRL` com 100% de cobertura (negativos, milhar, vírgula ausente, entrada inválida).
- Gráfico reflete inclusões/edições sem recarregar (`revalidatePath`).
- Filtro de contexto altera stats e gráfico (Pessoal × Trabalho × Freelance).
- E2E: cadastrar fonte CLT e PJ, lançar 6 meses, conferir base segura exibida contra valor calculado à mão.

### Dependências
F1.

---

## F4 · Finanças · Despesas & Importação Nubank

**Objetivo:** controle de despesas fixas × variáveis com ranking e histórico, alimentado por importação de extratos Nubank (OFX e CSV) idempotente via hash único.

### Regras de importação
- Formatos aceitos: OFX da conta (SGML 1.x e XML 2.x), CSV da conta (`Data,Valor,Identificador,Descrição`) e CSV do cartão (`date,title,amount`).
- Normalização da descrição: minúsculas, remoção de acentos (NFD), espaços colapsados, trim.
- `dedupe_hash = sha256(occurred_on | amount_cents | description_normalized | ordinal)`, em que `ordinal` é a posição entre linhas idênticas no mesmo arquivo. Isso preserva duas compras legítimas iguais no mesmo dia e mantém a reimportação idempotente.
- `external_id` (FITID/Identificador) gravado quando existir, com índice único parcial como segunda barreira.
- O arquivo inteiro também recebe `sha256`; reenviar o mesmo arquivo é bloqueado na prévia.
- Débitos viram despesas. Créditos aparecem na prévia com ação “registrar como ganho” (F3).
- Categorização automática por `category_rules` (substring na descrição normalizada), editável na prévia.
- Upload processado no servidor, limite 2 MB, nunca persistido em Storage.

### Entregáveis técnicos

**Banco**

```sql
create type expense_nature as enum ('fixed', 'variable');
create type expense_source as enum ('manual', 'import', 'capture', 'recurring');
create type import_format as enum ('ofx', 'nubank_account_csv', 'nubank_card_csv');

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  nature expense_nature not null default 'variable',
  monthly_budget_cents bigint check (monthly_budget_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern text not null,
  category_id uuid not null references expense_categories on delete cascade,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, pattern)
);

create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category_id uuid references expense_categories on delete set null,
  context context_kind not null default 'personal',
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_day smallint not null check (due_day between 1 and 31),
  match_pattern text,
  starts_on date not null default current_date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  format import_format not null,
  filename text not null,
  file_sha256 text not null,
  period_start date,
  period_end date,
  total_rows int not null default 0,
  inserted_rows int not null default 0,
  skipped_rows int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, file_sha256)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context context_kind not null default 'personal',
  category_id uuid references expense_categories on delete set null,
  recurring_expense_id uuid references recurring_expenses on delete set null,
  import_batch_id uuid references import_batches on delete set null,
  nature expense_nature not null default 'variable',
  source expense_source not null default 'manual',
  occurred_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null,
  description_normalized text not null,
  external_id text,
  dedupe_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_hash)
);

create unique index expenses_external_id_uidx on expenses (user_id, external_id) where external_id is not null;
create index expenses_user_date_idx on expenses (user_id, occurred_on desc);

create view v_expense_monthly with (security_invoker = true) as
select
  user_id,
  date_trunc('month', occurred_on)::date as month,
  coalesce(sum(amount_cents) filter (where nature = 'fixed'), 0)::bigint as fixed_cents,
  coalesce(sum(amount_cents) filter (where nature = 'variable'), 0)::bigint as variable_cents,
  sum(amount_cents)::bigint as total_cents
from expenses
group by user_id, date_trunc('month', occurred_on);

create view v_expense_ranking with (security_invoker = true) as
select
  e.user_id,
  date_trunc('month', e.occurred_on)::date as month,
  e.category_id,
  coalesce(c.name, 'Sem categoria') as category,
  c.monthly_budget_cents,
  sum(e.amount_cents)::bigint as total_cents,
  count(*)::int as qty
from expenses e
left join expense_categories c on c.id = e.category_id
group by e.user_id, date_trunc('month', e.occurred_on), e.category_id, c.name, c.monthly_budget_cents;

create or replace function import_expenses(p_batch_id uuid, p_rows jsonb)
returns int
language plpgsql
security invoker
as $$
declare
  v_inserted int;
begin
  with ins as (
    insert into expenses (
      occurred_on, amount_cents, description, description_normalized,
      dedupe_hash, external_id, category_id, nature, context, source, import_batch_id
    )
    select
      (r->>'occurred_on')::date,
      (r->>'amount_cents')::bigint,
      r->>'description',
      r->>'description_normalized',
      r->>'dedupe_hash',
      nullif(r->>'external_id', ''),
      nullif(r->>'category_id', '')::uuid,
      coalesce(nullif(r->>'nature', '')::expense_nature, 'variable'),
      coalesce(nullif(r->>'context', '')::context_kind, 'personal'),
      'import',
      p_batch_id
    from jsonb_array_elements(p_rows) r
    on conflict do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  update import_batches
  set total_rows = jsonb_array_length(p_rows),
      inserted_rows = v_inserted,
      skipped_rows = jsonb_array_length(p_rows) - v_inserted
  where id = p_batch_id;

  return v_inserted;
end;
$$;
```

**Next.js**
- `lib/parsers/normalize.ts`, `hash.ts` (Web Crypto `subtle.digest('SHA-256')`), `ofx.ts`, `nubank-csv.ts`, `detect.ts` (detecta formato pelo conteúdo, não pela extensão).
- `POST /api/import/nubank` (multipart): parse → aplica regras de categoria → consulta hashes já existentes → retorna prévia `{ rows, duplicates, credits, fileHash }`. Não grava nada.
- Server Action `commitImport(fileHash, rows)`: cria `import_batches` e chama `rpc('import_expenses')`. Retorna inseridas/ignoradas.
- Server Actions: `createExpense`, `updateExpense`, `deleteExpense`, `bulkCategorize`, `createCategory`, `createRule`, `createRecurring`, `undoImport(batchId)`.
- Matching de recorrentes: despesa importada cujo `description_normalized` contém `match_pattern` é vinculada ao recorrente e marcada `fixed`.
- Custos de infraestrutura freelance entram como recorrentes no contexto `freelance` (ex.: VPS Hetzner, `match_pattern = 'hetzner'`, ~R$ 36/mês). Cobrança em dólar chega no extrato já convertida em reais com IOF; o valor importado prevalece sobre o previsto e a diferença aparece no `FixedChecklist`.
- Margem por cliente: `/freelance` (F6) cruza ganhos do cliente com despesas `freelance` vinculadas ao projeto, mostrando se a infraestrutura repassada cobre o custo.

**Componentes**
- `/financas/despesas`: `Stat` total do mês, fixos, variáveis, saldo (ganhos − despesas); `ExpenseRanking` (barras horizontais 1px, estouro de orçamento em `--red` + texto `ESTOURO`); `ExpenseHistory` (barras mensais fixo × variável, 12 meses); `FixedChecklist` (recorrentes do mês: pago / pendente / atrasado); `ExpenseList` com filtros.
- `/financas/importar`: `FileDrop` (`.input` de arquivo), `ImportPreview` (`.row` com estado NOVA / DUPLICADA / CRÉDITO, categoria editável inline), `ImportSummary`, histórico de lotes com desfazer.

### Critérios de aceite
- Fixtures reais anonimizadas de cada formato em `tests/fixtures/` com testes Vitest de parser (encoding Latin-1 e UTF-8, valores negativos, datas `DD/MM/YYYY` e ISO, OFX SGML sem fechamento de tags).
- Importar o mesmo arquivo duas vezes: segunda tentativa bloqueada por `file_sha256`.
- Importar dois arquivos com períodos sobrepostos: zero duplicatas no banco (verificado por `count` antes/depois).
- Duas transações idênticas no mesmo dia no mesmo arquivo são ambas inseridas.
- “Desfazer importação” remove exatamente as linhas do lote.
- Ranking e histórico batem com soma manual de uma fixture conhecida.
- Arquivo de 2.000 linhas processado em menos de 5 s na Vercel.

### Dependências
F3 (créditos → ganhos, saldo do mês, `lib/money.ts`).

---

## F5 · Trilha de Objetivos

**Objetivo:** metas de curto, médio e longo prazo em formato de trilha, com progresso financeiro dinâmico e marcos.

### Entregáveis técnicos

**Banco**

```sql
create type goal_horizon as enum ('short', 'medium', 'long');
create type goal_status as enum ('active', 'achieved', 'paused', 'archived');

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context context_kind not null default 'personal',
  title text not null,
  description text,
  horizon goal_horizon not null,
  status goal_status not null default 'active',
  target_cents bigint check (target_cents > 0),
  target_date date,
  position int not null default 0,
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id uuid not null references goals on delete cascade,
  title text not null,
  position int not null default 0,
  due_on date,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id uuid not null references goals on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0),
  contributed_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create view v_goal_progress with (security_invoker = true) as
select
  g.id,
  g.user_id,
  g.context,
  g.title,
  g.horizon,
  g.status,
  g.target_cents,
  g.target_date,
  coalesce(c.saved_cents, 0) as saved_cents,
  case when g.target_cents > 0
    then least(100, round(100.0 * coalesce(c.saved_cents, 0) / g.target_cents, 1))
  end as pct,
  case when g.target_cents > 0 and g.target_date > current_date
    then ceil(greatest(g.target_cents - coalesce(c.saved_cents, 0), 0)::numeric
      / greatest(1, (extract(year from age(g.target_date, current_date)) * 12 + extract(month from age(g.target_date, current_date)))::int))::bigint
  end as monthly_needed_cents,
  coalesce(m.total, 0) as milestones_total,
  coalesce(m.done, 0) as milestones_done
from goals g
left join (
  select goal_id, sum(amount_cents)::bigint as saved_cents from goal_contributions group by goal_id
) c on c.goal_id = g.id
left join (
  select goal_id, count(*)::int as total, count(done_at)::int as done from goal_milestones group by goal_id
) m on m.goal_id = g.id;
```

**Next.js**
- Server Actions: `createGoal`, `updateGoal`, `reorderGoals`, `addContribution`, `withdrawContribution`, `toggleMilestone`, `achieveGoal`.
- Ao atingir 100%, `achieved_at` é preenchido e a meta passa para `achieved` com confirmação do usuário.

**Componentes**
- `GoalTrail`: trilha SVG em três trechos (Curto · Médio · Longo), cada meta um nó com filete; nó ativo em `--blue`, concluído em `--ink` sólido, atrasado em `--red` + texto `ATRASADA`. Em mobile vira lista vertical.
- `GoalCard`: “R$ 200,00 de R$ 750,00”, `Progress`, percentual mono, aporte mensal necessário, marcos com checkbox.
- `ContributionForm`, `GoalForm`, `MilestoneList`.

### Critérios de aceite
- Progresso, percentual e aporte mensal necessário corretos para meta sem prazo, prazo vencido, prazo no mês corrente e valor já superado.
- Retirada (aporte negativo) reduz o progresso e nunca deixa o percentual negativo na UI.
- Trilha navegável por teclado, legível em 360 px e em 2560 px.
- E2E: criar meta de R$ 750, aportar R$ 200, conferir 26,7%, concluir marco, atingir 100%.

### Dependências
F3 (`lib/money.ts` e padrões de formulários financeiros).

---

## F6 · Projetos & Pipeline Freelance

**Objetivo:** Kanban unificado para trabalho principal, projetos pessoais e freelance, com CRM leve de clientes e orçamentos ligado à renda variável.

### Entregáveis técnicos

**Banco**

```sql
create type project_status as enum ('active', 'on_hold', 'done', 'archived');
create type task_status as enum ('todo', 'doing', 'done');
create type deal_stage as enum ('lead', 'briefing', 'proposal', 'negotiation', 'won', 'lost');

create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid not null references clients on delete restrict,
  title text not null,
  stage deal_stage not null default 'lead',
  value_cents bigint check (value_cents > 0),
  expected_close_on date,
  closed_at timestamptz,
  lost_reason text,
  income_id uuid references incomes on delete set null,
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context context_kind not null,
  deal_id uuid references deals on delete set null,
  name text not null,
  description text,
  status project_status not null default 'active',
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context context_kind not null,
  project_id uuid references projects on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority priority_level not null default 'medium',
  due_on date,
  position numeric not null default 0,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_board_idx on tasks (user_id, status, position) where archived_at is null;
create index deals_board_idx on deals (user_id, stage, position);

create or replace function task_context_from_project()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is not null then
    select context into new.context from projects where id = new.project_id;
  end if;
  if new.status = 'done' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_context_sync
  before insert or update on tasks
  for each row execute function task_context_from_project();
```

**Next.js**
- Ordenação por índice fracionário: `position = (anterior + próximo) / 2`, rebalanceamento quando a diferença < 1e-6.
- Server Actions: `createTask`, `updateTask`, `moveTask(id, status, beforeId, afterId)`, `archiveDoneTasks`, `createProject`, `createClient`, `createDeal`, `moveDeal`, `winDeal`, `loseDeal`.
- `winDeal`: marca `won`, oferece criar projeto `freelance` vinculado e lançar `incomes` variável na fonte Freelance (F3), gravando `income_id`.
- Migration da F6 adiciona `project_id uuid references projects on delete set null` em `expenses` e `recurring_expenses`, habilitando a margem por cliente (receita do deal − custos do projeto, ex.: VPS).
- Atualização otimista com `useOptimistic` e rollback em erro.

**Componentes**
- `/projetos`: `KanbanBoard` (A FAZER · EM CURSO · ENTREGUE, drag and drop com `@dnd-kit`, suporte a teclado e toque, scroll horizontal com snap no mobile), `TaskCard` (filete superior, azul quando em curso, prazo vencido em `--red` + `ATRASADA`), `TaskDialog`, filtro por projeto e contexto.
- `/freelance`: `DealPipeline` (colunas por estágio), `DealCard` (valor mono), `ClientList`, `ClientDetail` (histórico de deals e receita total), `Stat` pipeline aberto, ganho no mês, taxa de conversão.

### Critérios de aceite
- Arrastar entre colunas e reordenar persiste após recarga em desktop, touch e teclado.
- 200 tarefas no quadro sem queda perceptível (INP < 200 ms).
- Contexto do alternador filtra o quadro; tarefa de projeto herda o contexto do projeto.
- `winDeal` cria ganho variável que aparece em `/financas/ganhos` e na base segura.
- E2E: lead → proposta → ganho → projeto criado → tarefa concluída.

### Dependências
F1 (shell e contexto) e F3 (ligação deal → ganho).

---

## F7 · Central de Infraestrutura & Servidores

**Objetivo:** visão em tempo quase real do estado de VPS, automações, APIs e sites, com alertas de vencimento de domínios, hospedagens e licenças.

### Papel da VPS existente (Hetzner + n8n)

O Meridian **não** é hospedado na VPS: ela atende um projeto freelance, roda com dados de cliente e não deve concentrar dados financeiros pessoais. Ela entra no Meridian em três papéis:

| Papel | Como |
|---|---|
| Primeiro inventário monitorado | VPS, n8n, sites estáticos e redirecionamentos servidos pelo Caddy viram `services`; domínio no Registro.br e crédito pré-pago da Hetzner viram `renewals`. Tudo cadastrado pela UI, nunca versionado (repositório público). |
| Canal de alertas | Mudança de estado de serviço e vencimentos disparam `POST` assinado para um webhook do n8n, que entrega por Telegram ou e-mail (Resend). O Meridian continua sem dependência dura: se o webhook falhar, o alerta segue visível no painel. |
| Watchdog externo | Um fluxo do n8n chama `GET /api/health` do Meridian a cada 10 min e alerta se falhar. Cobre o ponto cego de o próprio Meridian (Vercel ou Supabase) estar fora e não conseguir se autodiagnosticar. |

Inventário inicial previsto:

| Item | `kind` | Verificação |
|---|---|---|
| VPS Hetzner | `vps` | `http` numa rota de saúde do Caddy (`respond /healthz 200`) |
| n8n | `automation` | `http` em `/healthz` + `heartbeat` enviado ao fim de cada fluxo crítico |
| Site estático da cliente | `website` | `keyword` no HTML + validade do certificado TLS |
| Redirecionamento 301 | `website` | `http` com `expected_status = 301` |
| Domínio `.com.br` (Registro.br, R$ 40/ano) | renewal `domain` | `expires_on` via RDAP do Registro.br |
| Crédito pré-pago Hetzner (US$ 25, consumo ~US$ 7,09/mês) | renewal `credit` | `expires_on` projetado por saldo ÷ consumo |
| Subdomínios DuckDNS | `website` | `http`; queda indica IP desatualizado ou DuckDNS fora |

### Entregáveis técnicos

**Banco**

```sql
create type service_kind as enum ('vps', 'automation', 'api', 'website', 'database', 'other');
create type check_method as enum ('http', 'keyword', 'heartbeat', 'manual');
create type service_state as enum ('up', 'degraded', 'down', 'unknown');
create type renewal_kind as enum ('domain', 'hosting', 'license', 'certificate', 'subscription', 'credit');

create table services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context context_kind not null default 'personal',
  name text not null,
  kind service_kind not null,
  provider text,
  url text,
  check_method check_method not null default 'http',
  expected_status int not null default 200,
  keyword text,
  latency_warn_ms int not null default 1500,
  interval_minutes int not null default 10 check (interval_minutes >= 5),
  heartbeat_token uuid not null default gen_random_uuid() unique,
  last_state service_state not null default 'unknown',
  last_checked_at timestamptz,
  last_latency_ms int,
  last_change_at timestamptz,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table service_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  service_id uuid not null references services on delete cascade,
  checked_at timestamptz not null default now(),
  state service_state not null,
  status_code int,
  latency_ms int,
  error text
);

create index service_checks_service_time_idx on service_checks (service_id, checked_at desc);

create table renewals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  service_id uuid references services on delete set null,
  kind renewal_kind not null,
  name text not null,
  provider text,
  context context_kind not null default 'personal',
  expires_on date not null,
  currency text not null default 'BRL' check (currency in ('BRL', 'USD', 'EUR')),
  cost_cents bigint check (cost_cents > 0),
  billing_cycle text not null default 'yearly' check (billing_cycle in ('monthly', 'yearly', 'other')),
  balance_cents bigint check (balance_cents >= 0),
  monthly_burn_cents bigint check (monthly_burn_cents > 0),
  balance_updated_on date,
  owner_is_client boolean not null default false,
  auto_renew boolean not null default false,
  alert_days int[] not null default '{30,7,1}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'credit' or (balance_cents is not null and monthly_burn_cents is not null and balance_updated_on is not null))
);

create table alert_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  service_id uuid references services on delete cascade,
  renewal_id uuid references renewals on delete cascade,
  kind text not null check (kind in ('service_down', 'service_up', 'renewal_due', 'renewal_expired', 'credit_low')),
  dedupe_key text not null,
  payload jsonb not null default '{}',
  delivered_at timestamptz,
  delivery_error text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create view v_renewals_due with (security_invoker = true) as
select
  r.*,
  (r.expires_on - current_date) as days_left,
  case
    when r.expires_on < current_date then 'expired'
    when r.expires_on - current_date <= 7 then 'critical'
    when r.expires_on - current_date <= 30 then 'warning'
    else 'ok'
  end as urgency
from renewals r;

create or replace view v_service_uptime with (security_invoker = true) as
select
  service_id,
  user_id,
  round(100.0 * count(*) filter (where state = 'up') / nullif(count(*), 0), 2) as uptime_7d,
  round(avg(latency_ms))::int as avg_latency_7d
from service_checks
where checked_at > now() - interval '7 days'
group by service_id, user_id;
```

**Agendamentos (Supabase `pg_cron` + `pg_net`)**

```sql
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
select vault.create_secret('https://<app>.vercel.app', 'app_url');

select cron.schedule(
  'meridian-health',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/health',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

select cron.schedule(
  'meridian-checks-retention',
  '15 3 * * *',
  $$ delete from service_checks where checked_at < now() - interval '30 days'; $$
);
```

**Next.js**
- `GET|POST /api/cron/health`: valida `CRON_SECRET`, usa client `admin` (service role, apenas server), seleciona serviços `http`/`keyword` vencidos pelo `interval_minutes`, executa checagens em paralelo com `AbortSignal.timeout(8000)`, grava `service_checks` e atualiza `last_*`. Serviços `heartbeat` sem ping há mais de `2 × interval` viram `down`. `export const maxDuration = 60`.
- `POST /api/heartbeat/[token]`: endpoint para automações (n8n, cron da VPS, scripts) sinalizarem vida.
- `GET /api/health` público e sem dados: responde `{ ok, db }` após um `select 1` via Supabase. Alvo do watchdog no n8n. Fora do matcher do `proxy.ts`.
- `GET /api/cron/daily` (pg_cron 1×/dia): validade de certificados TLS via `node:tls`, `expires_on` de domínios via RDAP (`rdap.registro.br` para `.br`, `rdap.org` para o resto), projeção de crédito pré-pago (`balance_updated_on + balance ÷ monthly_burn`) e geração dos alertas de vencimento.
- `lib/alerts.ts`: grava `alert_events` com `dedupe_key` (ex.: `renewal:<id>:7d`, `service:<id>:down:<last_change_at>`) e envia `POST` para `ALERT_WEBHOOK_URL` com header `X-Meridian-Signature` (HMAC-SHA256 do corpo com `ALERT_WEBHOOK_SECRET`). Falha de entrega fica em `delivery_error` e é reenviada na próxima rodada.
- Fluxo n8n versionado em `docs/n8n/meridian-alerts.json` (webhook → valida HMAC → Telegram/Resend) e `docs/n8n/meridian-watchdog.json` (cron 10 min → `GET /api/health` → alerta), sem credenciais.
- Server Actions: `createService`, `updateService`, `checkNow(id)`, `createRenewal`, `renewNow(id)` (avança `expires_on` pelo ciclo), `topUpCredit(id, amount)` (atualiza saldo e reprojeta `expires_on`).

**Componentes**
- `/infra`: `Stat` online/total, incidentes 24 h, próximos vencimentos; `ServiceList` (`.row`: nome | latência mono | `Tag` ONLINE/LENTO/OFFLINE, offline em `--red`); `UptimeSparkline` 7 dias; `RenewalList` ordenada por `days_left` com `A VENCER` / `VENCIDO`; `ServiceForm` com snippet de heartbeat copiável (`curl -X POST .../api/heartbeat/<token>`).

### Critérios de aceite
- Derrubar um serviço de teste resulta em `OFFLINE` em até 10 min e volta a `ONLINE` após restaurar.
- Heartbeat ausente marca `down`; novo ping restaura.
- Chamada à rota de cron sem `Bearer` correto retorna 401.
- Vencimentos com 30/7/1 dias aparecem destacados; vencido aparece em `--red` com texto.
- Retenção mantém `service_checks` abaixo de 30 dias; tamanho do banco monitorado (< 100 MB).
- `SUPABASE_SECRET_KEY` ausente do bundle do cliente (verificado com busca no `.next/static`).
- Inventário da VPS cadastrado e com estado real; parar o container do n8n gera `OFFLINE` e alerta no Telegram/e-mail uma única vez, e a volta gera um único alerta `ONLINE`.
- Crédito Hetzner exibe data projetada de esgotamento e alerta 30/7/1 dias antes.
- Webhook com assinatura inválida é rejeitado pelo fluxo do n8n.
- Watchdog do n8n alerta quando `/api/health` falha (testado apontando para uma URL inexistente).

### Dependências
F1. Independente dos módulos financeiros. Para os alertas: VPS endurecida conforme `docs/VPS.md` e variáveis `ALERT_WEBHOOK_URL` e `ALERT_WEBHOOK_SECRET` na Vercel.

---

## F8 · Quick Capture & Visão Geral

**Objetivo:** capturar qualquer coisa em segundos de qualquer tela e consolidar todos os módulos numa página inicial editorial filtrada pelo contexto ativo.

### Sintaxe de captura

| Entrada | Destino |
|---|---|
| `$ 35,90 almoço #alimentacao` | despesa variável hoje, categoria por tag |
| `+ 1.200 site cliente X @freelance` | ganho variável |
| `t: revisar proposta !alta ^sexta` | tarefa (prioridade e prazo) |
| `https://...` | link: curso se domínio de curso conhecido, senão inbox |
| `m: notebook 750` | meta nova com alvo |
| texto livre | ideia na inbox |

`@pessoal`, `@trabalho`, `@freelance` sobrescrevem o contexto ativo.

### Entregáveis técnicos

**Banco**

```sql
create type capture_kind as enum ('idea', 'expense', 'income', 'task', 'link', 'goal');

create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context context_kind not null default 'personal',
  kind capture_kind not null default 'idea',
  raw_text text not null,
  url text,
  payload jsonb not null default '{}',
  routed_table text,
  routed_id uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index inbox_pending_idx on inbox_items (user_id, created_at desc) where processed_at is null;
```

**Next.js**
- `lib/capture/parse.ts`: parser puro e testável que retorna `{ kind, payload, context }`.
- Server Action `capture(raw)`: grava sempre em `inbox_items` e, quando o parse é inequívoco, roteia para a tabela de destino (`expenses`, `incomes`, `tasks`, `courses`, `goals`) preenchendo `routed_*`.
- Server Actions `triageItem(id, target)`, `discardItem(id)`.
- Página `/` (Visão Geral) com queries paralelas (`Promise.all`) e `Suspense` por seção.

**Componentes**
- `QuickCapture`: `Dialog` aberto por `Ctrl/Cmd + K` ou pelo `capture-fab` no mobile; prévia ao vivo do destino interpretado; Enter confirma, Esc fecha; foco retorna ao elemento anterior.
- `InboxTriage` (`/inbox`): itens não roteados com ações de envio.
- Visão Geral: `PageHead` com data da edição; stats Base segura · Saldo do mês · Pipeline aberto · Serviços online; seções Vencimentos próximos, Tarefas em curso, Metas ativas, Cursos em andamento, Últimas despesas.

### Critérios de aceite
- Parser com testes para todas as linhas da tabela de sintaxe, valores com e sem centavos, tags inexistentes e entradas ambíguas.
- Captura completa (abrir → digitar → salvar) em menos de 3 s sem sair da tela atual, em desktop e mobile.
- Item capturado aparece no módulo de destino e na Visão Geral imediatamente.
- Visão Geral com TTFB < 600 ms e LCP < 2,5 s em 4G simulado.
- Alternador de contexto altera todas as seções da Visão Geral.

### Dependências
F2, F3, F4, F5, F6, F7 (destinos da captura e fontes da Visão Geral).

---

## F9 · PWA, Offline, APK & Release 1.0

**Objetivo:** app instalável sem barra de navegação, utilizável com rede instável, empacotável como APK e endurecido para uso diário.

### Entregáveis técnicos

**PWA**
- `app/manifest.ts`: `display: 'standalone'`, `start_url: '/?source=pwa'`, `scope: '/'`, ícones 192/512 e maskable gerados de `logo/meridian-app-icon*.svg`, `shortcuts` (Capturar, Despesas, Kanban), `share_target` apontando para `/capture/share`.

```ts
share_target: {
  action: '/capture/share',
  method: 'GET',
  params: { title: 'title', text: 'text', url: 'url' },
},
```

- `theme-color` por tema com `media="(prefers-color-scheme: ...)"` conforme DS.
- Service Worker com Serwist (`@serwist/next`): precache do app shell, `NetworkFirst` para navegação com fallback `/offline`, `StaleWhileRevalidate` para fontes e estáticos, nunca cache de `/api/*` nem de respostas autenticadas do Supabase.
- Fila offline de Quick Capture em IndexedDB (`idb-keyval`), sincronizada no evento `online` e na abertura do app.
- Variantes `pwa:` (standalone) e `touch:` aplicadas; `safe-area-inset` e `min-h-dvh` revisados.

**APK (TWA)**
- PWABuilder → pacote Android TWA, `public/.well-known/assetlinks.json` com o SHA-256 da chave de assinatura, verificação Digital Asset Links sem barra de URL.

**Hardening**
- Headers em `next.config.ts`: CSP (com `connect-src` do Supabase), `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- Rate limit simples por IP em `/api/heartbeat` e `/api/import` (tabela `rate_limits` ou memória por instância).
- Supabase Advisors (security + performance) sem alertas; índices nas FKs indicados.
- Exportação completa dos dados em JSON/CSV em `/ajustes` (portabilidade e backup manual).
- Monitoramento: Vercel Analytics + Speed Insights (Hobby).

### Critérios de aceite
- Lighthouse mobile: Performance ≥ 90, Acessibilidade ≥ 95, Best Practices ≥ 95; critérios de instalabilidade atendidos.
- Instalado no Android e no Windows abre em standalone sem barra de navegação; no iOS via “Adicionar à Tela de Início”.
- Em modo avião: app abre, exibe última visão em cache ou `/offline`, captura entra na fila e sincroniza ao reconectar sem duplicar.
- Compartilhar um link do navegador do Android para o Meridian cria item na inbox.
- APK assinado instalado sem barra de URL (Digital Asset Links verificado).
- Suíte E2E completa verde em Chromium e WebKit mobile.
- Restauração completa a partir do backup semanal testada.

### Dependências
F8.

---

## Definição de pronto (vale para toda fase)

- Migrations versionadas, aplicadas em produção via CLI e tipos TypeScript regenerados.
- RLS habilitada e testada em toda tabela nova.
- Validação Zod no servidor em toda Server Action e Route Handler.
- Estados de carregamento, vazio e erro implementados em cada tela.
- Componentes usando apenas tokens do DS, conferidos nos temas claro e escuro.
- Testes unitários e E2E da fase passando no CI.
- Deploy em produção validado manualmente em desktop e no celular.

## Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Supabase Free pausa após 7 dias sem atividade | `pg_cron` a cada 5 min aciona a Vercel, que consulta o banco via API |
| Sem backup nativo no Free Tier | Dump semanal criptografado via GitHub Actions + exportação manual em `/ajustes` |
| Limite de 500 MB do banco | Valores em `bigint`, retenção de 30 dias em `service_checks`, uploads não armazenados |
| Mudança no layout do CSV/OFX do Nubank | Detecção por conteúdo, parsers isolados com fixtures e erro explícito de formato desconhecido |
| Timeout de função na Vercel Hobby | Checagens paralelas com timeout de 8 s e `maxDuration = 60` |
| `obsidian://` indisponível no dispositivo | Link desabilitado com aviso quando vault não configurado; fallback para abrir URL do curso |
| Vazamento da secret key | Usada apenas em `lib/supabase/admin.ts` com `import 'server-only'` e verificação no bundle no CI |
| VPS compartilhada com projeto de cliente | Meridian não hospeda nada nela; só monitora e usa o n8n como canal de alerta. Dados do servidor (IP, hostname) ficam no banco, nunca no repositório |
| Acesso SSH por senha como root na VPS | Endurecimento descrito em `docs/VPS.md` antes da F7 |
| Meridian fora do ar sem ninguém perceber | Watchdog externo no n8n chamando `/api/health` |
