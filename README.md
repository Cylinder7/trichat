# ⚡ TriChat Bridge

Link **Roblox chat**, **Discord chat** and **Minecraft chat** together — one message typed in any of the three appears in all of them, plus a live dashboard.

```
   Roblox  ──┐                     ┌──> Discord  sees [Roblox] + [Minecraft]
             ├──>  HUB (this app) ─┤
 Minecraft ──┘         │            └──> Roblox    sees [Discord] + [Minecraft]
                       v
                 live dashboard
                 (localhost:3000)
```

Messages look like:

- `[Minecraft] Steve: hey everyone` — shown in Roblox & Discord
- `[Discord] AlexP: welcome!` — shown in Roblox & Minecraft
- `[Roblox] Builderman: hi guys` — shown in Discord & Minecraft

## What's in this folder

| File | What it is |
|---|---|
| `server.js` | The hub — run this and everything connects |
| `bots/discord.js` | Discord bot (discord.js) |
| `bots/minecraft.js` | Minecraft bot (mineflayer — joins your server like a player) |
| `roblox/1-PASTE-IN-ServerScriptService.lua` | Roblox script #1 (paste into Studio) |
| `roblox/2-PASTE-IN-StarterPlayerScripts.lua` | Roblox script #2 (paste into Studio) |
| `public/` | The dashboard web page |
| `.env.example` | Configuration template → copy to `.env` and fill in |
| `start.bat` / `start.sh` | Double-click start scripts |

---

## Step 0 — Install Node.js (one time)

1. Go to **https://nodejs.org**
2. Download the **LTS** version and install it (keep clicking Next)
3. Check it worked: open Command Prompt and type `node -v` — you should see a version like `v20.x.x`

## Step 1 — Run the hub on your PC

1. Copy `.env.example` and rename the copy to exactly **`.env`**
2. Open `.env` in Notepad:
   - change `BRIDGE_SECRET=change-me-to-something-random` to your own secret word, e.g. `BRIDGE_SECRET=purple-cows-42` (remember it — the Roblox script needs the same one!)
   - the Discord / Minecraft lines can stay empty for now — the bridge still works and the dashboard runs
3. Open Command Prompt **in this folder** (type `cmd` in the File Explorer address bar and press Enter)
4. Run:

```
npm install
npm start
```

5. Open **http://localhost:3000** — that's your dashboard 🎉

> Tip: try `npm run demo` first to watch the dashboard with fake chat messages before wiring everything up!

## Step 2 — Discord bot (5 minutes)

1. Go to **https://discord.com/developers/applications** → **New Application** → give it a name (e.g. "TriChat") → Create
2. Left sidebar → **Bot** → under *Privileged Gateway Intents* turn ON **MESSAGE CONTENT INTENT** ← without this the bot can't read chat!
3. Still on the Bot page → **Reset Token** → **Copy Token** → paste it in your `.env` as `DISCORD_TOKEN=...`
   (Never share this token — it's the bot's password)
4. Left sidebar → **OAuth2 → URL Generator**:
   - Scopes: tick `bot`
   - Bot Permissions: tick `View Channels`, `Send Messages`, `Read Message History`
   - Copy the generated URL at the bottom, open it, and invite the bot to **your** server
5. In Discord: **Settings → Advanced → Developer Mode = ON**, then right-click the channel you want to bridge → **Copy Channel ID** → put it in `.env` as `DISCORD_CHANNEL_ID=...`
6. Restart the bridge (`Ctrl+C` then `npm start` again)

> The bridge only watches that ONE channel — make it something like `#trichat`.

## Step 3 — Minecraft (your own server)

Since you own the server, just tell the bot how to join it. Put in `.env`:

```
MC_HOST=localhost        (or your server's IP if it runs on another machine)
MC_PORT=25565
MC_USERNAME=ChatBridgeBot
```

- **If your server is offline-mode** (`online-mode=false` in `server.properties`): that's all you need.
- **If it's online-mode**: the bot needs a real Minecraft (Microsoft) account. Use a spare account: set `MC_USERNAME` and `MC_PASSWORD` in `.env`.
- **Paper/Purpur servers 1.19+**: if the bot connects but chat doesn't work, open `config/paper-global.yml` and set `enforce-secure-profile: false`, then restart the server.

Restart the bridge and watch the console: `[minecraft] Logged in!` — you'll see the bot walk into your server. It shows up in the player list as a normal player (you can `/op` it or whatever you like, it only chats).

## Step 4 — Roblox Studio (your own game)

1. Open your game in **Roblox Studio**
2. **Allow HTTP**: Home tab → **Game Settings → Security → Allow HTTP Requests = ON**
3. In Explorer, hover **ServerScriptService** → **+** → **Script** → delete the default code and paste in the whole contents of `roblox/1-PASTE-IN-ServerScriptService.lua`
4. At the top of that script, edit:
   - `BRIDGE_URL = "http://localhost:3000"` (keep this while testing on your PC)
   - `BRIDGE_SECRET = "..."` ← the **same secret** as your `.env`!
5. Hover **StarterPlayer → StarterPlayerScripts** → **+** → **LocalScript** → paste in `roblox/2-PASTE-IN-StarterPlayerScripts.lua`
6. **Publish** the game, then **Play** it

Type something in Roblox chat → it should appear on your dashboard at `localhost:3000`!

> While testing on your PC, Roblox Studio and the bridge both run on the same machine, so `localhost` works fine. (Note: only *you* see bridged messages while play-testing alone — invite a friend or two to really see it shine.)

## Step 5 — Test checklist

- [ ] Dashboard open at `http://localhost:3000`, Roblox chip is green while your game is running
- [ ] Type in Roblox → appears on dashboard, and Discord/Minecraft if set up
- [ ] Type in Discord `#trichat` → appears in Roblox + Minecraft
- [ ] Type in Minecraft → appears in Roblox + Discord
- [ ] Send from the dashboard → appears in all three

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard shows but bots are "disabled" | You skipped filling `.env`, or forgot to restart `npm start` |
| Discord bot online but can't read messages | Turn on **MESSAGE CONTENT INTENT** (Step 2.2) |
| Discord `login failed` | Token is wrong or you copied it with spaces |
| Minecraft bot can't connect | Wrong `MC_HOST`/`MC_PORT`, or the server is offline |
| Minecraft bot connects but chat doesn't relay | Paper 1.19+: set `enforce-secure-profile: false` (Step 3). Bot without a real account on an online-mode server also can't chat — use the spare-account route |
| Roblox script warns "Could not reach the hub" | Bridge not running, `BRIDGE_URL` wrong, or **Allow HTTP Requests** is off |
| Roblox messages never arrive | `BRIDGE_SECRET` in the script doesn't match `.env` |
| `npm start` says "Cannot find module" | Run `npm install` first |
| Port 3000 already in use | Change `PORT=3001` in `.env` (and in the Roblox script URL) |

## Customizing

- **Message format**: edit `formatForChat()` in `server.js`
- **Roblox poll rate**: `POLL_INTERVAL` at the top of the Roblox server script
- **Dashboard colors**: CSS variables at the top of `public/style.css`

For free 24/7 hosting (bridge + Minecraft server), see **HOSTING.md**.
