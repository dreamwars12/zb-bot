const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  StringSelectMenuBuilder
} = require("discord.js");

const Parser = require("rss-parser");
const axios = require("axios");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const parser = new Parser();

const NEWS_CHANNEL_ID = process.env.CHANNEL_ID;
const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const TICKET_BANNER_URL = process.env.TICKET_BANNER_URL;

const EVENT_CHANNEL_ID = process.env.EVENT_CHANNEL_ID;
const RECOMPENSES_CHANNEL_ID = process.env.RECOMPENSES_CHANNEL_ID;
const VIP_CHANNEL_ID = process.env.VIP_CHANNEL_ID;
const EVENT_PING_ROLE_ID = process.env.EVENT_PING_ROLE_ID;
const USE_EVERYONE_EVENT = process.env.USE_EVERYONE_EVENT === "true";

const TWITCH_USERNAME = process.env.TWITCH_USERNAME;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let postedNews = new Set();
let twitchToken = null;
let wasLive = false;
let spamMap = new Map();

function isStaff(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID);
}

function getEventPing() {
  if (USE_EVERYONE_EVENT) return "@everyone";
  if (EVENT_PING_ROLE_ID) return `<@&${EVENT_PING_ROLE_ID}>`;
  return "";
}

async function sendLog(guild, title, description, color = 0x8b00ff) {
  if (!LOG_CHANNEL_ID) return;
  const channel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Le Terrain des Rois • Logs" });

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
  const t = String(title || "").toLowerCase();
  if (t.includes("patch notes")) return "Notes de mise à jour NBA 2K26";
  if (t.includes("season")) return "Nouvelle saison NBA 2K26";
  if (t.includes("event")) return "Nouvel événement NBA 2K26";
  return title || "Actualité NBA 2K26";
}

function explainNews(title, text) {
  const c = (String(title || "") + " " + String(text || "")).toLowerCase();
  if (c.includes("patch")) return "Mise à jour : gameplay, bugs, stabilité ou équilibrage.";
  if (c.includes("season")) return "Nouvelle saison : récompenses, XP, événements ou contenus.";
  if (c.includes("myteam")) return "Actu MyTEAM : cartes, packs ou défis.";
  if (c.includes("mycareer") || c.includes("city")) return "Actu MaCarrière / Ville.";
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
      "✅ Respect obligatoire\n" +
      "🚫 Pas de spam / pub sauvage\n" +
      "🏀 Utilise les bons salons\n" +
      "💸 Arnaques interdites\n" +
      "🛡️ Respect du staff\n" +
      "🔥 Bonne ambiance\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ Clique sur ✅ pour accepter le règlement."
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Règlement" })
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
});

client.on("guildMemberAdd", async (member) => {
  const channel = await member.guild.channels.fetch(process.env.WELCOME_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👑 Nouveau membre !")
    .setDescription(
      `Bienvenue ${member} sur **Le Terrain des Rois** !\n\n` +
      "📜 Va accepter le règlement\n" +
      "🏀 Présente ton build NBA 2K\n" +
      "🎁 Participe aux events\n" +
      "👥 Invite tes potes pour faire grandir le serveur"
    )
    .setColor(0x8b00ff)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

async function sendTicketPanel(channel) {
  const embeds = [];

  if (TICKET_BANNER_URL) {
    embeds.push(new EmbedBuilder().setImage(TICKET_BANNER_URL).setColor(0x8b00ff));
  }

  embeds.push(
    new EmbedBuilder()
      .setTitle("🎫 CENTRE D’AIDE — LE TERRAIN DES ROIS")
      .setDescription(
        "Sélectionne une catégorie pour ouvrir un ticket.\n\n" +
        "🛠️ Support\n" +
        "🚨 Signalement\n" +
        "🏀 Pro-Am\n" +
        "🤝 Partenariat"
      )
      .setColor(0x8b00ff)
      .setTimestamp()
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("🎫 Choisis ton ticket")
    .addOptions(
      { label: "Support", value: "support", emoji: "🛠️" },
      { label: "Signalement", value: "signalement", emoji: "🚨" },
      { label: "Pro-Am", value: "proam", emoji: "🏀" },
      { label: "Partenariat", value: "partenaire", emoji: "🤝" }
    );

  await channel.send({
    embeds,
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}

async function createTicket(interaction, type) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
  if (!category) return interaction.editReply("❌ Catégorie ticket introuvable.");

  const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const ticketName = `ticket-${type}-${username}`;

  const existing = guild.channels.cache.find(c => c.name === ticketName);
  if (existing) return interaction.editReply("❌ Tu as déjà un ticket : " + existing.toString());

  const overwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles
      ]
    }
  ];

  const staffRole = guild.roles.cache.get(STAFF_ROLE_ID);
  if (staffRole) {
    overwrites.push({
      id: staffRole.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages
      ]
    });
  }

  const ticketChannel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: overwrites
  });

  const questions = {
    support: "Explique ton problème clairement.",
    signalement: "Envoie le pseudo, preuve et explication.",
    proam: "Présente ton poste, ton build et tes dispos.",
    partenaire: "Présente ton serveur, tes stats et ce que tu proposes."
  };

  const embed = new EmbedBuilder()
    .setTitle("🎫 Ticket " + type.toUpperCase())
    .setDescription(
      `${interaction.user}\n\n${questions[type] || "Explique ta demande."}\n\n` +
      "Un staff va te répondre."
    )
    .setColor(0x8b00ff)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Fermer")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${staffRole ? staffRole.toString() : ""} ${interaction.user}`,
    embeds: [embed],
    components: [row]
  });

  await sendLog(guild, "🎫 Ticket créé", `${interaction.user.tag} a ouvert ${ticketChannel}`, 0x00ff00);
  interaction.editReply("✅ Ticket créé : " + ticketChannel.toString());
}

async function sendAutoQuestion() {
  const channel = await client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const questions = [
    "🔥 Tu préfères 99 dunk ou 99 tir à 3 points ?",
    "🏀 Tu joues Park, REC ou Pro-Am ?",
    "👑 Prime LeBron, Prime Jordan ou Prime Kobe ?",
    "🎯 Drop ton build NBA 2K en screen 👇",
    "💎 C’est quoi ton meilleur insigne ?",
    "⚡ Qui est chaud pour jouer ce soir ?",
    "🎮 Tu joues à quoi en ce moment ?",
    "🏆 Qui veut un tournoi 1v1 bientôt ?"
  ];

  const q = questions[Math.floor(Math.random() * questions.length)];

  const embed = new EmbedBuilder()
    .setTitle("🏀 QUESTION DU JOUR")
    .setDescription(`**${q}**\n\nRéponds dans le chat 👇`)
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Activité auto" })
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

async function sendMiniEvent() {
  const channel = await client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const events = [
    "🎬 Drop ton meilleur clip NBA 2K. Le meilleur gagne **VIP 24h** 👑",
    "🔥 Envoie ton meilleur build. Le staff choisit le build du jour.",
    "🏀 Tournoi 1v1 bientôt : qui participe ? Répondez maintenant.",
    "📸 Poste ton meilleur screen NBA 2K.",
    "👥 Objectif serveur : invite 1 pote. À 50 membres = giveaway.",
    "💎 Montre ton outfit NBA 2K. Le plus stylé gagne."
  ];

  const event = events[Math.floor(Math.random() * events.length)];

  const embed = new EmbedBuilder()
    .setTitle("🎉 MINI EVENT")
    .setDescription(`**${event}**\n\nParticipe maintenant 👇`)
    .setColor(0x9b00ff)
    .setFooter({ text: "Le Terrain des Rois • Event auto" })
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

async function sendBusinessPost() {
  const channel = await client.channels.fetch(RECOMPENSES_CHANNEL_ID || EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🎁 COMMENT GAGNER DES RÉCOMPENSES ?")
    .setDescription(
      "Plus tu aides le serveur, plus tu peux gagner.\n\n" +
      "👥 **Invite des amis**\n" +
      "🎬 **Poste des clips**\n" +
      "🏀 **Participe aux events**\n" +
      "🔥 **Sois actif dans le chat**\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "🏆 Récompenses possibles :\n" +
      "• VIP 24h / 7 jours\n" +
      "• Rôle spécial\n" +
      "• Mise en avant de ton clip\n" +
      "• Place dans le Hall of Fame\n\n" +
      "🎯 Objectif : faire grandir **Le Terrain des Rois**."
    )
    .setColor(0xffd700)
    .setFooter({ text: "Le Terrain des Rois • Récompenses" })
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

async function sendGiveaway(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎁 GIVEAWAY VIP")
    .setDescription(
      "Réagis avec 🎉 pour participer.\n\n" +
      "🎁 Gain : **VIP 7 jours**\n" +
      "⏰ Tirage par le staff\n\n" +
      "Plus tu es actif, plus tu auras des chances dans les futurs events."
    )
    .setColor(0xffd700)
    .setFooter({ text: "Le Terrain des Rois • Giveaway" })
    .setTimestamp();

  const msg = await channel.send({ content: getEventPing(), embeds: [embed] });
  await msg.react("🎉").catch(() => {});
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
    const titreFR = translateTitle(item.title);
    const explication = explainNews(item.title, resume);

    const embed = new EmbedBuilder()
      .setTitle("🏀 NBA 2K26 — NOUVELLE ACTU")
      .setDescription(
        `📢 **${titreFR}**\n\n` +
        `📝 **Résumé :**\n${resume || "Pas beaucoup de texte."}\n\n` +
        `💡 **Explication :**\n${explication}`
      )
      .setURL(item.link)
      .setColor(0xff7a00)
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
    "https://id.twitch.tv/oauth2/token?client_id=" + TWITCH_CLIENT_ID +
    "&client_secret=" + TWITCH_CLIENT_SECRET +
    "&grant_type=client_credentials"
  );
  twitchToken = res.data.access_token;
}

async function checkTwitchLive() {
  try {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USERNAME) return;
    if (!twitchToken) await getTwitchToken();

    const res = await axios.get("https://api.twitch.tv/helix/streams?user_login=" + TWITCH_USERNAME, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: "Bearer " + twitchToken
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
          `**${TWITCH_USERNAME} est en live !**\n\n` +
          `🎮 Jeu : ${live.game_name || "Gaming"}\n` +
          `📌 Titre : ${live.title || "Live en cours"}\n\n` +
          `📺 https://www.twitch.tv/${TWITCH_USERNAME}`
        )
        .setImage(live.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"))
        .setColor(0x9146ff)
        .setTimestamp();

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Rejoindre le live")
          .setStyle(ButtonStyle.Link)
          .setURL("https://www.twitch.tv/" + TWITCH_USERNAME)
      );

      await channel.send({
        content: "@everyone 🔴 **LIVE LANCÉ !**",
        embeds: [embed],
        components: [button]
      });
    }

    if (!live && wasLive) {
      wasLive = false;

      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle("⚫ LIVE TERMINÉ")
        .setDescription(`Le live de **${TWITCH_USERNAME}** est terminé. Merci à ceux qui sont passés 💜`)
        .setColor(0x2b2d31)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.log("Erreur Twitch :", err.response?.data || err.message);
    twitchToken = null;
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();

  if (content === "!ticketpanel") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return sendTicketPanel(message.channel);
  }

  if (content === "!question") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return sendAutoQuestion();
  }

  if (content === "!event") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return sendMiniEvent();
  }

  if (content === "!recompenses") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return sendBusinessPost();
  }

  if (content === "!giveaway") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return sendGiveaway(message.channel);
  }

  if (isStaff(message.member)) return;

  if (/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(message.content)) {
    await message.delete().catch(() => {});
    await message.member.timeout(15 * 60 * 1000, "Pub Discord interdite").catch(() => {});
    return sendLog(message.guild, "🚫 Pub bloquée", `${message.author.tag} a envoyé une pub.`, 0xff0000);
  }

  const now = Date.now();
  const id = message.author.id;
  const list = (spamMap.get(id) || []).filter(t => now - t < 5000);
  list.push(now);
  spamMap.set(id, list);

  if (list.length >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(10 * 60 * 1000, "Spam").catch(() => {});
    return sendLog(message.guild, "⚠️ Anti-spam", `${message.author.tag} a spam.`, 0xffaa00);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    return createTicket(interaction, interaction.values[0]);
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === "close_ticket") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Seul le staff peut fermer.", ephemeral: true });
    }

    await interaction.reply("🔒 Ticket fermé dans 5 secondes.");
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
});

client.once("ready", async () => {
  console.log("✅ Bot connecté : " + client.user.tag);

  await postReglement();
  await checkNBA2KNews(false);
  await checkTwitchLive();

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);

  setInterval(sendAutoQuestion, 4 * 60 * 60 * 1000);
  setInterval(sendMiniEvent, 8 * 60 * 60 * 1000);
  setInterval(sendBusinessPost, 24 * 60 * 60 * 1000);
});

client.login(process.env.TOKEN);
