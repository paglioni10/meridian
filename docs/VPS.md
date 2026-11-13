# VPS · Endurecimento e integração com o Meridian

Guia para a VPS Hetzner (Ubuntu 24.04, Docker, n8n, Caddy). IP, hostname e domínios ficam fora deste arquivo porque o repositório é público; substitua `<IP>` e `<usuario>` ao executar.

Faça na ordem e **mantenha a sessão SSH atual aberta** até confirmar que o novo acesso funciona numa segunda janela.

## 1. Chave SSH (no seu Windows, PowerShell)

```powershell
ssh-keygen -t ed25519 -C "meridian-vps"
```

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@<IP> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

```powershell
ssh root@<IP>
```

O último comando deve entrar sem pedir a senha do servidor (pode pedir a senha da chave, se você definiu uma).

## 2. Usuário administrativo (no servidor, como root)

```bash
adduser <usuario>
```

```bash
usermod -aG sudo,docker <usuario>
```

```bash
rsync --archive --chown=<usuario>:<usuario> ~/.ssh /home/<usuario>
```

Numa **nova** janela, confirme:

```powershell
ssh <usuario>@<IP>
```

```bash
sudo whoami
```

## 3. Desligar senha e root no SSH

No Ubuntu 24.04 o cloud-init cria `/etc/ssh/sshd_config.d/50-cloud-init.conf` com `PasswordAuthentication yes`, e no OpenSSH vale o primeiro valor lido. Por isso o arquivo abaixo começa com `00-`.

```bash
sudo tee /etc/ssh/sshd_config.d/00-hardening.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
AllowUsers <usuario>
EOF
```

```bash
sudo sshd -t && sudo systemctl restart ssh
```

Teste numa nova janela antes de fechar a antiga:

```powershell
ssh <usuario>@<IP>
```

```powershell
ssh root@<IP>
```

O primeiro deve entrar; o segundo deve ser recusado com `Permission denied (publickey)`.

## 4. Firewall e proteção contra força bruta

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
```

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

```bash
sudo ufw enable && sudo ufw status verbose
```

```bash
sudo apt update && sudo apt install -y fail2ban unattended-upgrades
```

```bash
sudo tee /etc/fail2ban/jail.d/sshd.local > /dev/null <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
```

```bash
sudo systemctl enable --now fail2ban && sudo fail2ban-client status sshd
```

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
```

O Docker publica portas por fora do `ufw`. Hoje o n8n está em `127.0.0.1:5678`, o que é seguro; mantenha qualquer container novo também preso a `127.0.0.1` e exposto só pelo Caddy. Para conferir:

```bash
sudo ss -tlnp | grep -v 127.0.0
```

Só devem aparecer as portas 22, 80 e 443.

Opcional: no painel da Hetzner, **Firewalls → Create Firewall** com as mesmas regras (22, 80, 443) aplicado ao servidor, como segunda camada.

## 5. Rota de saúde no Caddy

Em `/etc/caddy/Caddyfile`, dentro do bloco do domínio do n8n:

```caddy
handle /healthz-vps {
	respond "ok" 200
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

O n8n já expõe `/healthz`. No Meridian (F7) ficam dois serviços: `https://<dominio-n8n>/healthz-vps` (VPS + Caddy) e `https://<dominio-n8n>/healthz` (n8n).

## 6. Backup do n8n

O volume `n8n_data` guarda fluxos e credenciais da cliente. Snapshot semanal do servidor no painel da Hetzner (**Backups**, +20% do valor do plano) ou export manual:

```bash
docker run --rm -v n8n_data:/data -v "$HOME":/backup alpine tar czf /backup/n8n_data-$(date +%F).tar.gz -C /data .
```

## 7. Integração com o Meridian (F7)

| Item | Onde |
|---|---|
| Webhook de alertas | Fluxo n8n `docs/n8n/meridian-alerts.json`: Webhook → valida `X-Meridian-Signature` (HMAC-SHA256 com `ALERT_WEBHOOK_SECRET`) → e-mail (SMTP) |
| Watchdog | Fluxo n8n `docs/n8n/meridian-watchdog.json`: Schedule 10 min → `GET https://<meridian>/api/health` → alerta se status ≠ 200 |
| Heartbeat | Último nó de cada fluxo crítico: HTTP Request `POST https://<meridian>/api/heartbeat/<token>` |
| Variáveis na Vercel | `ALERT_WEBHOOK_URL` (URL de produção do webhook n8n) e `ALERT_WEBHOOK_SECRET` (`openssl rand -hex 32`), ambas Secret |

## Checklist

- [ ] Login por chave com usuário próprio funciona
- [ ] `ssh root@<IP>` e login por senha recusados
- [ ] `ufw status` mostra apenas 22, 80 e 443
- [ ] `fail2ban-client status sshd` ativo
- [ ] Atualizações automáticas de segurança ligadas
- [ ] `/healthz-vps` responde 200
- [ ] Backup do `n8n_data` configurado
