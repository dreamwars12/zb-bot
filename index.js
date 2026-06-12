const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const Parser = require("rss-parser");
const axios = require("axios");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const parser = new Parser();

const NEWS_CHANNEL_ID = process.env.CHANNEL_ID;
const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;

const TWITCH_USERNAME = process.env.TWITCH_USERNAME;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let postedNews = new Set();
let twitchToken = null;
let wasLive = false;

function cleanText(text) {
  if (!text) return "Résumé non disponible.";
  return text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").slice(0, 900);
}

async function postReglement() {
  const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 20 });
  if (messages.some(m => m.embeds[0]?.title === "📜 RÈGLEMENT OFFICIEL")) return;

  const embed = new EmbedBuilder()
    .setTitle("📜 RÈGLEMENT OFFICIEL")
    .setDescription("Bienvenue sur **Le Terrain des Rois** 🏀\n\nLis bien les règles avant de parler.")
    .addFields(
      { name: "👑 Respect", value: "Respecte tous les membres. Pas d’insultes graves, menaces ou harcèlement." },
      { name: "🚫 Spam / Pub", value: "Spam, pub sauvage, liens suspects et flood interdits." },
      { name: "🏀 NBA 2K26", value: "Parle dans les bons salons : builds, actus, clips, événements, aide." },
      { name: "💸 Arnaques", value: "Vente de VC fake, comptes, glitchs ou faux giveaways interdits." },
      { name: "🛡️ Staff", value: "Le staff peut sanctionner si le règlement n’est pas respecté." },
      { name: "🔥 Ambiance", value: "Reste chill, aide les joueurs et profite du serveur." }
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • NBA 2K26" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

async function checkNBA2KNews(firstStart = false) {
  const channel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const feed = await parser.parseURL("https://store.steampowered.com/feeds/news/app/3472040/");

  if (firstStart) {
    feed.items.slice(0, 5).forEach(item => postedNews.add(item.link));
    return;
  }

  for (const item of feed.items.slice(0, 5).reverse()) {
    if (postedNews.has(item.link)) continue;
    postedNews.add(item.link);

    const embed = new EmbedBuilder()
      .setTitle(`🏀 ${item.title}`)
      .setDescription(`📰 **Résumé :**\n${cleanText(item.contentSnippet || item.content || item.summary)}`)
      .setURL(item.link)
      .setColor(0xff7a00)
      .setFooter({ text: "NBA 2K26 Actus • Automatique" })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Lire l’article")
        .setStyle(ButtonStyle.Link)
        .setURL(item.link)
    );

    await channel.send({ embeds: [embed], components: [button] });
  }
}

async function getTwitchToken() {
  const res = await axios.post(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
  );
  twitchToken = res.data.access_token;
}

async function checkTwitchLive() {
  try {
    if (!twitchToken) await getTwitchToken();

    const res = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${twitchToken}`
      }
    });

    const live = res.data.data[0];

    if (live && !wasLive) {
      wasLive = true;

      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle("🔴 LIVE TWITCH LANCÉ !")
        .setDescription(
          `**${TWITCH_USERNAME} est en live maintenant !**\n\n` +
          `🏀 Stream NBA 2K26\n` +
          `👑 Venez soutenir le live et rejoindre la communauté.\n\n` +
          `👉 https://www.twitch.tv/${TWITCH_USERNAME}`
        )
        .addFields(
          { name: "🎮 Jeu", value: live.game_name || "NBA 2K26", inline: true },
          { name: "👀 Viewers", value: String(live.viewer_count || 0), inline: true }
        )
        .setImage(live.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"))
        .setColor(0x9146ff)
        .setFooter({ text: "Le Terrain des Rois • Twitch" })
        .setTimestamp();

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Rejoindre le live")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.twitch.tv/${TWITCH_USERNAME}`)
      );

      await channel.send({
        content: "@everyone 🔴 **LIVE LANCÉ !**",
        embeds: [embed],
        components: [button]
      });
    }

    if (!live) wasLive = false;
  } catch (err) {
    console.log("Erreur Twitch :", err.message);
    twitchToken = null;
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  await postReglement();
  await checkNBA2KNews(true);

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);
});

client.login(process.env.TOKEN);
