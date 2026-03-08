# VikingClaw — Production Deployment Guide

Everything needed to take vikingclaw.com live.

---

## What's Ready

| Asset | Location |
|---|---|
| Landing page | `C:\VikingClaw\landing\index.html` |
| Linux/Mac installer | `C:\VikingClaw\landing\install.sh` |
| Windows installer | `C:\VikingClaw\landing\install.ps1` |
| Netlify config | `C:\VikingClaw\landing\netlify.toml` |
| DNS guide | `C:\VikingClaw\landing\DNS_SETUP.md` |
| Git repo (local) | `C:\VikingClaw\landing\.git` → origin: medioteq/vikingclaw-site |

---

## Fastest Path to Live: Netlify (Free, ~10 min)

### Step 1 — Push to GitHub

```powershell
Set-Location "C:\VikingClaw\landing"
# Add your PAT first:
git remote set-url origin https://<YOUR_PAT>@github.com/medioteq/vikingclaw-site.git
git push -u origin master
```

### Step 2 — Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **New site from Git**
2. Choose GitHub → select `medioteq/vikingclaw-site`
3. Build settings: leave blank (static site, no build command)
4. Click **Deploy site**

### Step 3 — Add Custom Domain

1. Netlify → Site Settings → **Domain Management** → Add custom domain
2. Enter: `vikingclaw.com`
3. Netlify will show you DNS records to add

### Step 4 — DNS Records (at your registrar)

| Type | Name | Value |
|---|---|---|
| A | @ | 75.2.60.5 |
| CNAME | www | [your-site].netlify.app |

**DNS propagation:** Usually 5–30 minutes. Test with:
```bash
dig vikingclaw.com
# or
nslookup vikingclaw.com
```

### Step 5 — SSL

Netlify provisions Let's Encrypt SSL automatically once DNS resolves. No action needed.

---

## Alternative: Cloudflare Pages (Even Faster CDN)

1. Push to GitHub (same Step 1 above)
2. [dash.cloudflare.com](https://dash.cloudflare.com) → Pages → New project → Connect to Git
3. Select `medioteq/vikingclaw-site`, deploy
4. Custom Domains → add `vikingclaw.com`
5. DNS (in Cloudflare):
   - CNAME: `@` → `[your-pages].pages.dev` (Proxied ✅)
   - CNAME: `www` → `[your-pages].pages.dev` (Proxied ✅)

---

## HQ Dashboard (hq.vikingclaw.com)

The landing redirects `/hq` → `https://hq.vikingclaw.com`.

To serve the HQ dashboard at that subdomain:
- Point `hq.vikingclaw.com` A/CNAME record to wherever HQ runs
- Or use a separate Netlify/Cloudflare Pages project for the HQ app

---

## Domain Registrar Options (if not yet purchased)

| Registrar | Price/yr | Notes |
|---|---|---|
| Cloudflare Registrar | ~$10 | Best DNS management, at-cost pricing |
| Namecheap | ~$12 | Good UI, free WhoisGuard |
| GoDaddy | ~$15 | Fine but upsell-heavy |

---

## Verify Once Live

```bash
# Landing page
curl -I https://vikingclaw.com
# → HTTP/2 200

# Linux installer
curl -fsSL https://vikingclaw.com/install.sh | head -5
# → #!/bin/sh ...

# Windows installer (PowerShell)
irm https://vikingclaw.com/install.ps1 | Select-String "vikingclaw.com"
# → $Site = "https://vikingclaw.com"
```

---

## Install Commands (for the README / docs)

```bash
# Linux / Mac / WSL
curl -fsSL https://vikingclaw.com/install.sh | sh

# Windows (PowerShell)
irm https://vikingclaw.com/install.ps1 | iex
```

---

## Timeline Summary

| Step | Time |
|---|---|
| Push to GitHub + Netlify deploy | ~2 min |
| Add custom domain in Netlify | ~1 min |
| Update DNS records at registrar | ~2 min |
| DNS propagation | 5–30 min |
| SSL provisioning (auto) | ~1 min after DNS |
| **Total to live** | **~15–35 min** |
