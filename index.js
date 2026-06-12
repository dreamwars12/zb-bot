const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

const Parser = require("rss-parser");
const axios = require("axios");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const parser = new Parser();

const NEWS_CHANNEL_ID = process.env.CHANNEL_ID;
const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;

const TWITCH_USERNAME = process.env.TWITCH_USERNAME;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let postedNews = new Set();
let twitchToken = null;
let wasLive = false;

const spamMap = new Map();
const joinTimes = [];

function isStaff(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

async function sendLog(title, description, color = 0xff0000) {
  const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => {});
}

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

function translateTitle(title) {
  const t = title.toLowerCase();

  if (t.includes("patch notes")) return "Notes de mise à jour NBA 2K26";
  if (t.includes("season") && t.includes("courtside report")) return "Rapport officiel de saison NBA 2K26";
  if (t.includes("festival")) return "Événement spécial NBA 2K26";
  if (t.includes("event")) return "Nouvel événement NBA 2K26";

  return title;
}

function explainNews(title, text) {
  const content = `${title} ${text}`.toLowerCase();

  if (content.includes("patch") || content.includes("notes")) {
    return "Mise à jour : corrections de bugs, ajustements gameplay, stabilité ou changements dans certains modes.";
  }

  if (content.includes("season")) {
    return "Nouvelle saison : récompenses, niveaux, événements, vêtements, animations ou contenu MyCAREER/MyTEAM.";
  }

  if (content.includes("festival") || content.includes("event")) {
    return "Événement limité : XP, VC, récompenses spéciales ou défis disponibles pendant une durée limitée.";
  }

  if (content.includes("myteam")) {
    return "Actu MyTEAM : cartes, packs, défis, récompenses ou événements du mode.";
  }

  if (content.includes("mycareer") || content.includes("city")) {
    return "Actu MaCarrière / Ville : quêtes, récompenses, événements ou nouveautés pour ton joueur.";
  }

  return "Nouvelle information NBA 2K26 détectée automatiquement.";
}

async function postReglement() {
  const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (messages && messages.some(m => m.embeds[0]?.title?.includes("ACCÈS AU SERVEUR"))) return;

  const embed = new EmbedBuilder()
    .setTitle("👑 LE TERRAIN DES ROIS — ACCÈS AU SERVEUR")
    .setDescription(
      "🏀 **Bienvenue sur Le Terrain des Rois**\n" +
      "Communauté **NBA 2K26 • Fortnite • FiveM**\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "📜 **RÈGLEMENT OFFICIEL**\n\n" +
      "✅ **Respect obligatoire**\n" +
      "Aucune insulte grave, menace, harcèlement ou provocation abusive.\n\n" +
      "🚫 **Spam / Pub interdit**\n" +
      "Pas de flood, pub sauvage, liens suspects ou arnaques.\n\n" +
      "🏀 **Utilise les bons salons**\n" +
      "Builds, Pro-Am, clips, actus, annonces, FiveM, Fortnite.\n\n" +
      "💸 **Arnaques interdites**\n" +
      "VC fake, faux giveaways, vente de comptes ou scams = sanction.\n\n" +
      "🛡️ **Respect du staff**\n" +
      "Les décisions du staff doivent être respectées.\n\n" +
      "🔥 **Bonne ambiance**\n" +
      "Reste chill, aide les autres et profite du serveur.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ **Clique sur ✅ pour accepter le règlement et débloquer les salons.**"
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Vérification officielle" })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed] });
  await msg.react("✅").catch(() => {});
}

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  if (reaction.message.channel.id !== REGLEMENT_CHANNEL_ID) return;
  if (reaction.emoji.name !== "✅") return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.add(MEMBER_ROLE_ID).catch(() => {});
  sendLog("✅ Vérification", `${user.tag} a accepté le règlement.`, 0x00ff00);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (isStaff(message.member)) return;

  const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i;
  const linkRegex = /(https?:\/\/|www\.)/i;

  if (inviteRegex.test(message.content)) {
    await message.delete().catch(() => {});
    await sendLog("🚫 Invitation bloquée", `${message.author.tag} a envoyé une invitation Discord dans ${message.channel}.`);
    return;
  }

  const now = Date.now();
  const userId = message.author.id;

  if (!spamMap.has(userId)) spamMap.set(userId, []);
  const timestamps = spamMap.get(userId).filter(t => now - t < 5000);
  timestamps.push(now);
  spamMap.set(userId, timestamps);

  if (timestamps.length >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(5 * 60 * 1000, "Anti-spam automatique").catch(() => {});
    await sendLog("⚠️ Anti-spam", `${message.author.tag} a été mute 5 minutes pour spam.`);
  }
});

client.on("guildMemberAdd", async (member) => {
  const now = Date.now();
  joinTimes.push(now);

  while (joinTimes.length && now - joinTimes[0] > 30000) joinTimes.shift();

  await sendLog("👤 Nouveau membre", `${member.user.tag} vient de rejoindre le serveur.`, 0x00ff00);

  if (joinTimes.length >= 8) {
    await sendLog(
      "🚨 ALERTE RAID",
      `Beaucoup de membres viennent de rejoindre rapidement : **${joinTimes.length} en 30 secondes**.\nSurveille le serveur.`,
      0xff0000
    );
  }
});

client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;

  await sendLog(
    "🗑️ Message supprimé",
    `Auteur : ${message.author?.tag || "Inconnu"}\nSalon : ${message.channel}\nMessage : ${message.content || "Impossible à lire"}`,
    0xffaa00
  );
});

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
    const titreFR = translateTitle(item.title);
    const explication = explainNews(item.title, resume);

    const embed = new EmbedBuilder()
      .setTitle("🏀 NBA 2K26 — NOUVELLE ACTUALITÉ")
      .setDescription(
        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
        `📢 **${titreFR}**\n` +
        `🌍 *Titre original : ${item.title}*\n\n` +
        `📝 **Résumé :**\n${resume || "Le flux ne donne pas beaucoup de texte, mais l’actu est bien détectée."}\n\n` +
        `💡 **Explication rapide :**\n${explication}\n\n` +
        "🎯 **À surveiller :** récompenses, événements, patchs, VC, XP ou nouveautés.\n\n" +
        "━━━━━━━━━━━━━━━━━━━━━━"
      )
      .setURL(item.link)
      .setColor(0xff7a00)
      .setThumbnail("https://cdn.cloudflare.steamstatic.com/steam/apps/3472040/header.jpg")
      .setFooter({ text: "Le Terrain des Rois • NBA 2K26 Actus" })
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
