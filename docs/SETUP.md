# Setup de produção (F0)

Passos manuais que dependem das suas contas. Nenhum segredo ou e-mail pessoal vai para o repositório, que é público.

## 1. Supabase

1. Criar projeto `meridian` na região **South America (São Paulo)**. Guardar a senha do banco num gerenciador de senhas.
2. **Project Settings → API Keys**: copiar a `Publishable key` e criar/copiar uma `Secret key`.
3. Vincular e aplicar as migrations:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <project-ref>
```

```bash
npx supabase db push --remote
```

4. **Authentication → Sign In / Providers**:
   - `Allow new users to sign up`: **desligado**.
   - Email provider ligado, `Confirm email` ligado.
5. **Authentication → URL Configuration**:
   - Site URL: `https://<seu-app>.vercel.app`
   - Redirect URLs: `https://<seu-app>.vercel.app/auth/callback`, `https://*-<sua-conta>.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`
6. **Authentication → Emails → Magic Link**: trocar o link do template para funcionar mesmo abrindo o e-mail em outro dispositivo:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/">Entrar no Meridian</a>
```

7. Criar seu usuário (cadastro público está desligado):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SECRET_KEY=<secret> ALLOWED_EMAILS=<seu-email> node scripts/create-users.mjs
```

## 2. Vercel

1. **Add New → Project** → importar `paglioni10/meridian`. Framework detectado: Next.js.
2. Variáveis de ambiente (Production e Preview):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<seu-app>.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
| `SUPABASE_SECRET_KEY` | secret key (marcar como Sensitive) |
| `ALLOWED_EMAILS` | seu e-mail (vários separados por vírgula) |
| `CRON_SECRET` | `openssl rand -hex 32` (usado a partir da F7) |

3. Deploy. Push na `main` publica produção; cada PR ganha um preview.

## 3. GitHub

1. **Settings → Branches → Add rule** para `main`: exigir PR e os checks `app` e `database` do workflow CI.
2. Backup semanal. Gerar o par de chaves `age` na sua máquina (a chave privada nunca sai dela):

```bash
age-keygen -o meridian-backup.key
```

3. **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|---|---|
| `SUPABASE_DB_URL` | Connection string **Session pooler** (Project Settings → Database), com a senha |
| `AGE_RECIPIENT` | linha `public key: age1...` do arquivo gerado |

4. **Actions → Backup → Run workflow** uma vez para validar. Para restaurar:

```bash
age -d -i meridian-backup.key meridian-<data>.tar.gz.age | tar -xzf - -C restore
```

```bash
psql "<db-url-destino>" -f restore/roles.sql -f restore/schema.sql -f restore/data.sql
```

## Checklist de aceite da F0

- [ ] Push na `main` gera deploy de produção com SSL; PR gera preview.
- [ ] Magic link funciona em produção; e-mail fora de `ALLOWED_EMAILS` não recebe acesso.
- [ ] Acessar `/` sem sessão redireciona para `/login`.
- [ ] `npm run db:reset` local recria o banco sem erro e `npm run db:test` passa.
- [ ] CI verde.
- [ ] Backup executado manualmente e restaurado num banco local.
