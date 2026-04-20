# DigitalOcean 2 GB Deployment

This setup keeps the current chatbot retrieval quality online by keeping:

- `Chroma DB`
- `sentence-transformers`
- `Gemini` as the hosted text-generation provider

It does **not** try to run Ollama on the droplet. Ollama stays available for local demos.

## Recommended shape

- Ubuntu Droplet: `Basic / 2 GB RAM / 1 vCPU / 50 GB SSD`
- Nginx serves the built Vite frontend from `/var/www/keanglobal/dist`
- `uvicorn` runs the FastAPI backend on `127.0.0.1:8000`
- Nginx proxies `/chat`, `/api/`, and `/health` to the backend
- Gemini handles generation
- Chroma DB stays on disk inside the backend app directory

## Why this shape works

- The frontend and backend share one domain, so the app can use relative API paths in production.
- The vector DB and downloaded embedding model stay on persistent disk.
- You keep semantic retrieval quality close to local.
- You avoid trying to run a local Ollama model on a 2 GB server.

## Expected monthly cost

- Droplet: about `$12/month`
- Optional backup: extra
- Domain: separate, if needed

Gemini API usage is separate from DigitalOcean.

## First-time server setup

1. Create the droplet and SSH in.
2. Install system packages:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx nodejs npm certbot python3-certbot-nginx
```

3. Create app folders:

```bash
sudo mkdir -p /opt/keanglobal
sudo mkdir -p /var/www/keanglobal
sudo chown -R $USER:$USER /opt/keanglobal /var/www/keanglobal
```

4. Copy the repo to `/opt/keanglobal`:

```bash
git clone <your-repo-url> /opt/keanglobal
```

## Backend setup

```bash
cd /opt/keanglobal/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.production.example .env
```

Edit `/opt/keanglobal/backend/.env`:

```env
PRIMARY_LLM_PROVIDER=gemini
ENABLE_OLLAMA_FALLBACK=0
GEMINI_API_KEY=your-real-key
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

## Frontend build

```bash
cd /opt/keanglobal
npm install
npm run build
rsync -a dist/ /var/www/keanglobal/dist/
```

No `VITE_API_URL` is required for this single-domain setup.

## Systemd service

1. Create a deploy user if you want a dedicated service account:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo chown -R deploy:deploy /opt/keanglobal
```

2. Copy the service file:

```bash
sudo cp /opt/keanglobal/ops/systemd/keanglobal-backend.service /etc/systemd/system/
```

3. Reload and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable keanglobal-backend
sudo systemctl start keanglobal-backend
sudo systemctl status keanglobal-backend
```

## Nginx

1. Copy the Nginx config:

```bash
sudo cp /opt/keanglobal/ops/nginx/keanglobal.conf /etc/nginx/sites-available/keanglobal
```

2. Edit the domain name in the file.
3. Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/keanglobal /etc/nginx/sites-enabled/keanglobal
sudo nginx -t
sudo systemctl reload nginx
```

4. Add HTTPS:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Updating the app

```bash
cd /opt/keanglobal
git pull
cd backend
source venv/bin/activate
pip install -r requirements.txt
cd ..
npm install
npm run build
rsync -a dist/ /var/www/keanglobal/dist/
sudo systemctl restart keanglobal-backend
sudo systemctl reload nginx
```

## Local behavior

Local demos can keep using Ollama by setting:

```env
PRIMARY_LLM_PROVIDER=ollama
ENABLE_OLLAMA_FALLBACK=1
```

For hosted deployment, keep:

```env
PRIMARY_LLM_PROVIDER=gemini
ENABLE_OLLAMA_FALLBACK=0
```

## Notes

- The backend may download the `all-MiniLM-L6-v2` sentence-transformers model on first boot if it is not already cached.
- The app's knowledge files are small enough for this server size; RAM is the real constraint, not disk.
- If the droplet starts swapping heavily or response times get inconsistent under load, move up to `4 GB`.
