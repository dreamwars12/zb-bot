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
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function explainNews(title, text) {
  const content = `${title} ${text}`.toLowerCase();

  if (content.includes("patch") || content.includes("notes")) {
    return "C’est une mise à jour du jeu. Elle peut corriger des bugs, modifier le gameplay, ajuster certains modes ou améliorer la stabilité.";
  }

  if (content.includes("season")) {
    return "C’est une nouvelle saison NBA 2K26. Il peut y avoir de nouvelles récompenses, événements, niveaux, vêtements, animations ou contenus MyCAREER/MyTEAM.";
  }

  if (content.includes("festival") || content.includes("event")) {
    return "C’est sûrement un événement limité. Il peut donner de l’XP, des VC, des récompenses spéciales ou des défis à faire pendant une durée limitée.";
  }

  if (content.includes("myteam")) {
    return "Cette actu concerne surtout MyTEAM : cartes, packs, défis, récompenses ou événements liés au mode.";
  }

  if (content.includes("mycareer") || content.includes("city")) {
    return "Cette actu concerne sûrement MaCarrière / La Ville : événements, récompenses, quêtes ou nouveautés pour ton joueur.";
  }

  return "Nouvelle information NBA 2K26. Regarde le résumé et le lien pour voir les détails complets.";
}

async function postReglement() {
  const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (messages && messages.some(m => m.embeds[0]?.title?.includes("LE TERRAIN DES ROIS"))) return;

  const embed = new EmbedBuilder()
    .setTitle("👑 LE TERRAIN DES ROIS — RÈGLEMENT")
    .setDescription(
      "🏀 **Bienvenue dans la communauté NBA 2K26 FR.**\n\n" +
      "🎮 Ici on parle **NBA 2K26, Fortnite, FiveM, builds, Pro-Am, clips, actus et streams.**\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ **Respect obligatoire**\n" +
      "Aucune insulte grave, menace, harcèlement ou provocation abusive.\n\n" +
      "🚫 **Spam / Pub interdit**\n" +
      "Pas de flood, liens suspects, pubs sauvages ou arnaques.\n\n" +
      "🏀 **Salons adaptés**\n" +
      "Utilise les bons salons : build-lab, pro-am, actus, highlights, annonces.\n\n" +
      "💸 **Arnaques interdites**\n" +
      "VC fake, faux giveaways, vente de comptes ou scams = sanction.\n\n" +
      "🛡️ **Staff**\n" +
      "Les décisions du staff doivent être respectées.\n\n" +
      "🔥 **Ambiance**\n" +
      "Reste chill, aide les joueurs et profite du serveur.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "✅ Réagis avec ✅ si tu acceptes le règlement."
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Règlement officiel" })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed] });
  await msg.react("✅").catch(() => {});
}

async function checkNBA2KNews(firstStart = false) {
  const channel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const feed = await parser.parseURL("https://store.steampowered.com/feeds/news/app/3472040/");

  if (firstStart) {
    feed.items.slice(0, 5).forEach(item => postedNews.add(item.link));
    console.log("✅ Actus NBA 2K26 chargées sans spam.");
    return;
  }

  for (const item of feed.items.slice(0, 5).reverse()) {
    if (postedNews.has(item.link)) continue;
    postedNews.add(item.link);

    const resume = cleanText(item.contentSnippet || item.content || item.summary);
    const explication = explainNews(item.title, resume);

    const embed = new EmbedBuilder()
      .setTitle("🏀 NBA 2K26 — NOUVELLE ACTU")
      .setDescription(
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        `📢 **${item.title}**\n\n` +
        `📝 **Résumé :**\n${resume || "Le flux ne donne pas assez de texte, mais l’actu est bien détectée."}\n\n` +
        `💡 **Ce que ça veut dire :**\n${explication}\n\n` +
        "━━━━━━━━━━━━━━━━━━━━━━"
      )
      .setURL(item.link)
      .setColor(0xff7a00)
      .setThumbnail("https://cdn.cloudflare.steamstatic.com/steam/apps/3472040/header.jpg")
      .setFooter({ text: "NBA 2K26 Actus • Mise à jour automatique" })
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
          `🎮 **Jeu :** ${live.game_name || "Gaming"}\n` +
          `📌 **Titre :** ${live.title || "Live en cours"}\n\n` +
          "👑 Venez soutenir le live et rejoindre la communauté.\n" +
          `📺 https://www.twitch.tv/${TWITCH_USERNAME}`
        )
        .addFields(
          { name: "👀 Viewers", value: String(live.viewer_count || 0), inline: true },
          { name: "📡 Statut", value: "En direct", inline: true }
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
  await checkNBA2KNews(false);

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);
});

client.login(process.env.TOKEN);
