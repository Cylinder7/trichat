/**
 * TriChat Bridge — Discord bot
 * ============================
 * Started automatically by server.js when DISCORD_TOKEN and
 * DISCORD_CHANNEL_ID are set in .env (see README Step 2).
 *
 *  - Messages typed in your bridge channel  → sent to the hub
 *  - Messages from Roblox / Minecraft       → posted into the channel
 */

function start(api, status, bus) {
  // discord.js is required lazily so the hub still runs without it installed
  let discordjs;
  try {
    discordjs = require('discord.js');
  } catch (e) {
    status.discord.connected = false;
    status.discord.detail = 'discord.js not installed — run: npm install';
    console.error('[discord] discord.js is not installed. Run `npm install` in this folder.');
    return;
  }
  const { Client, GatewayIntentBits } = discordjs;

  const TOKEN = process.env.DISCORD_TOKEN;
  const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // required to read message text!
    ],
  });

  client.once('ready', () => {
    status.discord.connected = true;
    status.discord.detail = `Logged in as ${client.user.tag}`;
    console.log(`[discord] Logged in as ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: 'Roblox + Minecraft chat' }],
      status: 'online',
    });
  });

  // Discord → hub
  client.on('messageCreate', (m) => {
    if (m.author.bot) return; // never relay other bots (or ourselves!)
    if (m.channel.id !== CHANNEL_ID) return; // only watch the bridge channel
    const content = (m.content || '').trim();
    if (!content) return;
    api.addMessage('discord', m.author.username, content);
  });

  // hub → Discord
  bus.on('message', (msg) => {
    if (msg.platform === 'discord') return; // don't echo Discord back into Discord
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) return;
    let text = api.formatForChat(msg);
    if (text.length > 1990) text = text.slice(0, 1990) + '…'; // Discord limit is 2000
    channel.send(text).catch((e) => console.error('[discord] send failed:', e.message));
  });

  client.on('error', (e) => console.error('[discord] client error:', e.message));
  client.on('shardDisconnect', () => {
    status.discord.connected = false;
    status.discord.detail = 'Disconnected — discord.js is retrying automatically';
  });
  client.on('shardReconnecting', () => {
    status.discord.detail = 'Reconnecting…';
  });

  client.login(TOKEN).catch((e) => {
    status.discord.connected = false;
    status.discord.detail = 'Login failed — check DISCORD_TOKEN in .env';
    console.error('[discord] login failed:', e.message);
  });
}

module.exports = { start };
