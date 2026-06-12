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
  if (!text) return "Aucun résumé disponible pour cette actualité.";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .slice(0, 900);
}

async function postReglement() {
  const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (messages && messages.some(m => m.embeds[0]?.title?.includes("RÈGLEMENT OFFICIEL"))) return;

  const welcome = new EmbedBuilder()
    .setTitle("👑 BIENVENUE SUR LE TERRAIN DES ROIS")
    .setDescription(
      "🏀 **Communauté NBA 2K26 FR**\n" +
      "🎮 **Fortnite • FiveM • NBA 2K26**\n" +
      "🔥 Respect • Ambition • Progression\n\n" +
      "Lis le règlement avant de parler sur le serveur."
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Communauté Gaming" })
    .setTimestamp();

  const rules = new EmbedBuilder()
    .setTitle("📜 RÈGLEMENT OFFICIEL")
    .addFields(
      { name: "✅ Respect", value: "Respecte tous les membres. Pas d’insultes graves, menaces ou harcèlement." },
      { name: "🚫 Pub / Spam", value: "Pub sauvage, flood, spam et liens suspects interdits." },
      { name: "🏀 Salons", value: "Utilise les bons salons : NBA 2K26, Fortnite, FiveM, clips, actus, aide." },
      { name: "💸 Arnaques", value: "Interdit de vendre des VC fake, comptes, glitchs ou faux giveaways." },
      { name: "🛡️ Staff", value: "Les décisions du staff doivent être respectées." },
      { name: "🔥 Ambiance", value: "Reste chill, aide les joueurs et profite de la communauté." }
    )
    .setColor(0xff7a00)
    .setFooter({ text: "Réagis avec ✅ si tu acceptes le règlement" });

  await channel.send({ embeds: [welcome, rules] });
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

    const resume = cleanText(item.contentSnippet || item.content || item.summary);

    const embed = new EmbedBuilder()
      .setTitle("🏀 NOUVELLE ACTUALITÉ NBA 2K26")
      .setDescription(
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        `📢 **${item.title}**\n\n` +
        `📝 **Résumé :**\n${resume}\n\n` +
        "🎯 **Catégorie :** Actualité / Mise à jour\n" +
        "━━━━━━━━━━━━━━━━━━━━━━"
      )
      .setURL(item.link)
      .setColor(0xff7a00)
      .setThumbnail("https://cdn.cloudflare.steamstatic.com/steam/apps/3472040/header.jpg")
      .setFooter({ text: "NBA 2K26 Actus • Automatique" })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Lire l’article complet")
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
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USERNAME) return;
    if (!twitchToken) await getTwitchToken();

    const res = await axios.get(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${twitchToken}`
        }
      }
    );

    const live = res.data.data[0];

    if (live && !wasLive) {
      wasLive = true;

      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle("🔴 LIVE TWITCH LANCÉ !")
        .setDescription(
          `**${TWITCH_USERNAME} est en live maintenant !**\n\n` +
          "🏀 **Stream NBA 2K26 / Gaming**\n" +
          "👑 Venez soutenir le live et rejoindre la communauté.\n\n" +
          `📺 **Lien :** https://www.twitch.tv/${TWITCH_USERNAME}`
        )
        .addFields(
          { name: "🎮 Jeu", value: live.game_name || "Gaming", inline: true },
          { name: "👀 Viewers", value: String(live.viewer_count || 0), inline: true }
        )
        .setImage(live.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"))
        .setColor(0x9146ff)
        .setFooter({ text: "Le Terrain des Rois • Twitch Live" })
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
