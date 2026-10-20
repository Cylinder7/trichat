# 🌍 Hosting TriChat Bridge for free (24/7)

Your PC doesn't have to stay on forever — here's the honest state of **free** hosting in 2026, and how to move the bridge (and maybe your Minecraft server) off your desk.

## Part 1 — Hosting the *bridge* for free

### ✅ Recommended: Render.com (free tier)

1. Put the `trichat-bridge` folder on GitHub (create an account → New repository → upload the files — **do not** upload your `.env`!)
2. Sign up at **https://render.com** (free)
3. **New + → Web Service** → connect your GitHub repo
4. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Scroll to **Environment** → add variables (same ones as your `.env`):
   - `BRIDGE_SECRET` = your secret
   - `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`
   - `MC_HOST`, `MC_PORT`, `MC_USERNAME` (and `MC_PASSWORD` if needed)
   - Render sets `PORT` for you — the bridge already uses it 👍
6. Deploy! You get a URL like `https://trichat-bridge-xxxx.onrender.com`

Then update your Roblox script:

```lua
local BRIDGE_URL = "https://trichat-bridge-xxxx.onrender.com"
```

**The honest catch:** free Render services fall asleep after ~15 minutes with no traffic, and a sleeping service takes ~1 minute to wake up. In practice:
- While someone is in your Roblox game, it polls the bridge every second → **stays awake**
- When everything's quiet, it sleeps → the first message after a quiet period may take a minute to go through

Good enough for a free start. When you outgrow it, any $5/mo VPS runs it 24/7 with zero sleep.

### Other options at a glance

| Host | Free 24/7? | Notes |
|---|---|---|
| **Render (free)** | ⚠️ sleeps when idle | Easiest start — recommended |
| **Oracle Cloud "Always Free"** | ✅ yes | Genuinely free VPS, but setup is technical (Linux server) |
| **Railway** | ❌ trial credit only | One-time ~$5 credit, then paid |
| **Fly.io** | ❌ needs card | Pay-as-you-go; tiny bridges cost almost nothing |
| **Vercel / Netlify** | ❌ won't work | Serverless — can't hold Discord/MC bot connections |

## Part 2 — Free 24/7 *Minecraft server* hosting

Same honesty as above: "free + always-on + good quality" doesn't fully exist for Minecraft (servers need real CPU/RAM). Closest options:

| Host | Free plan | 24/7? | The catch |
|---|---|---|---|
| **Aternos** (aternos.org) | ✅ yes | ⚠️ no | Most popular free host. Server **sleeps when empty** — you (or friends) press Start on aternos.org or their app, wait in a short queue, then it's online. Great for playing sessions |
| **FalixNodes** (falixnodes.net) | ✅ yes | ⚠️ mostly | Free 24/7-ish panel hosting with ads; ~1–2 GB RAM, servers can stop occasionally and need a click to resume |
| **Minehut** (minehut.com) | ✅ yes | ⚠️ sleeps | Free server sleeps when empty; wakes on join |
| **Exaroton** (exaroton.com) | ⚠️ credits | ✅ while credits last | Pay-per-minute with cheap credit packs — very reliable, sleep/wake on demand |

### Recommended combo for $0

- **Bridge** → Render free tier
- **Minecraft server** → Aternos (start it when you play) or FalixNodes (closest to 24/7)
- **Roblox** → your game, already hosted by Roblox for free 👍
- **Discord** → Discord is free, obviously 😄

### Pointing the bridge at your hosted Minecraft server

Wherever your server ends up (Aternos/Falix/your own PC), the bot just needs the address:

```
MC_HOST=yourserver.aternos.me
MC_PORT=25565          (some hosts give a port or a proxy address — copy exactly what they show)
MC_USERNAME=ChatBridgeBot
```

⚠️ **Aternos note:** the bot can only join while the server is online (started). If your server uses online-mode, the bot needs the spare Microsoft account trick from README Step 3. If Aternos kicks the bot, restart the bridge — it retries every 10 seconds automatically and will hop back in next time the server is up.

## Quick checklist when moving from PC → hosted

1. Code is on GitHub (no `.env` committed!)
2. Environment variables set in the host's dashboard
3. Roblox script: `BRIDGE_URL` = your new public URL → republish the game
4. Open `https://your-bridge-url.onrender.com` — the dashboard follows you anywhere now
5. Friends type in Discord / Minecraft / Roblox and everyone sees everything 🎉
