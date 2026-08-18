# Hetzner Deployment — Lokaler Event-Chat

Kompletter Setup-Guide für Hetzner Cloud (getestet mit CX11 / CX21).

## 1. Hetzner Cloud Server bereitstellen

1. Auf https://console.hetzner.cloud einen neuen Server anlegen:
   - **Image**: Ubuntu 24.04 LTS
   - **Größe**: CX11 (2 vCPU, 4 GB RAM) reicht für kleine Events; CX21 für ~500 gleichzeitige Nutzer
   - **Firewall**: SSH (22), HTTP (80), HTTPS (443) offen — ausserdem 8001 NUR öffnen, wenn Sie Backend direkt exponieren wollen (nicht empfohlen)
   - **SSH-Key** hinterlegen
2. Server-IP notieren.

## 2. Server-Grundlagen

```bash
ssh root@<server-ip>

# System aktualisieren
apt update && apt upgrade -y

# Docker installieren (offizielle Anleitung)
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Nicht-Root-User (empfohlen)
adduser eventadmin
usermod -aG docker eventadmin
```

## 3. Code auf den Server

Zwei Wege:

**A) Aus GitHub:**
```bash
su - eventadmin
git clone https://github.com/<ihr-user>/<repo>.git eventchat
cd eventchat
```

**B) Per SCP:**
Auf Ihrem lokalen Rechner:
```bash
scp -r ./event-chat eventadmin@<server-ip>:~/eventchat
ssh eventadmin@<server-ip>
cd eventchat
```

## 4. Environment vorbereiten

```bash
cp .env.example .env
nano .env
```

Wichtig:
- `JWT_SECRET`: neuen Wert generieren
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
- `ADMIN_PASSWORD`: starkes Passwort setzen
- `SEED_DEMO="false"`
- `REACT_APP_BACKEND_URL=""` (Frontend nutzt den Same-Origin-Proxy in `frontend/nginx.conf`)

## 5. Deployment starten

```bash
docker compose up -d --build
```

Der erste Build dauert 2–4 Min. Danach läuft:
- Frontend + Nginx auf Port 80
- Backend intern (nicht öffentlich exponiert)
- MongoDB intern (nicht öffentlich exponiert)

Öffnen: `http://<server-ip>` — Login mit `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

## 6. Domain + HTTPS (empfohlen)

DNS: A-Record von `chat.ihre-domain.de` auf die Server-IP.

Auf dem Server:
```bash
sudo apt install -y certbot
sudo systemctl stop docker  # temp, damit certbot Port 80 hat
sudo certbot certonly --standalone -d chat.ihre-domain.de
sudo systemctl start docker
```

Dann in `docker-compose.yml` folgende Anpassung am `frontend`-Service:
```yaml
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

Und in `frontend/nginx.conf` einen zweiten Server-Block ergänzen:
```nginx
server {
    listen 443 ssl http2;
    server_name chat.ihre-domain.de;
    ssl_certificate     /etc/letsencrypt/live/chat.ihre-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.ihre-domain.de/privkey.pem;
    # ... (Rest wie im ersten Block: /api-Proxy + SPA-Fallback)
}
server {
    listen 80;
    server_name chat.ihre-domain.de;
    return 301 https://$host$request_uri;
}
```

Zertifikat automatisch erneuern:
```bash
sudo crontab -e
# füge hinzu:
0 3 * * * certbot renew --quiet --deploy-hook "docker compose -f /home/eventadmin/eventchat/docker-compose.yml restart frontend"
```

## 7. Betrieb

```bash
# Status
docker compose ps

# Logs
docker compose logs -f backend
docker compose logs -f frontend

# Update nach Code-Änderungen
git pull
docker compose up -d --build

# MongoDB-Backup (täglich per cron empfohlen)
docker compose exec -T mongo mongodump --archive --db event_chat > "backup-$(date +%F).archive"

# Restore
cat backup-2026-XX-XX.archive | docker compose exec -T mongo mongorestore --archive
```

## 8. Firewall (empfohlen)

Auf Hetzner-Konsole eine Firewall an den Server hängen, die nur folgende Ports zulässt:
- 22 (SSH) — idealerweise nur von Ihrer IP
- 80 + 443 (HTTP/S)

Backend-Port 8001 und MongoDB-Port 27017 dürfen **niemals** öffentlich sein — beides läuft nur im Docker-Netzwerk.

## 9. Nach dem Event

Wenn das Event vorbei ist:
```bash
# Stop, aber Daten behalten
docker compose stop

# Komplett entfernen inkl. Daten (VORSICHT!)
docker compose down -v
```

## Troubleshooting

| Problem | Lösung |
|---|---|
| Login schlägt fehl | `docker compose logs backend` — meist falsches `ADMIN_PASSWORD` in `.env` |
| CORS-Fehler im Browser | `REACT_APP_BACKEND_URL` sollte leer sein bei Nginx-Proxy-Setup |
| Uploads verschwinden nach Update | Sicherstellen, dass `uploads_data`-Volume in `docker-compose.yml` mounted ist |
| Backend nicht erreichbar | `docker compose restart backend` und Logs prüfen |
| Frontend zeigt weiße Seite | Build hat REACT_APP_BACKEND_URL nicht bekommen — Container mit `--build` neu erzeugen |

## Ressourcen

- Hetzner Cloud Docs: https://docs.hetzner.com/cloud
- Certbot: https://certbot.eff.org
- Docker: https://docs.docker.com
