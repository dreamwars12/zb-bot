console.log("🚀 DÉMARRAGE DU BOT...");

process.on("unhandledRejection", (reason) => console.error("❌ UNHANDLED REJECTION:", reason));
process.on("uncaughtException", (err) => console.error("❌ UNCAUGHT EXCEPTION:", err));

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

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 CENTRE SUPPORT — LE TERRAIN DES ROIS")
    .setDescription(
      "Choisis la catégorie qui correspond à ta demande.\n\n" +
      "🛒 **Boutique** — achat, paiement, commande\n" +
      "👑 **VIP** — rôle VIP, lifetime, avantages\n" +
      "💳 **Paiement PayPal** — paiement bloqué / preuve\n" +
      "🏀 **NBA 2K** — build, jump shot, insignes, Pro-Am\n" +
      "🏆 **Crew / Pro-Am** — recrutement, team, test\n" +
      "🚨 **Signalement** — signaler un membre\n" +
      "🤝 **Partenariat** — partenariat serveur\n" +
      "🛠️ **Support** — autre demande\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "⚠️ N’ouvre pas plusieurs tickets pour la même demande."
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Tickets" })
    .setTimestamp();

  if (TICKET_BANNER_URL && TICKET_BANNER_URL.startsWith("http")) {
    embed.setImage(TICKET_BANNER_URL);
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("🎫 Ouvrir un ticket")
    .addOptions(
      { label: "Boutique", value: "boutique", emoji: "🛒", description: "Achat, commande, boutique" },
      { label: "VIP", value: "vip", emoji: "👑", description: "VIP normal, lifetime, rôle" },
      { label: "Paiement PayPal", value: "paypal", emoji: "💳", description: "Paiement bloqué ou preuve" },
      { label: "NBA 2K", value: "nba", emoji: "🏀", description: "Build, jump shot, insignes" },
      { label: "Crew / Pro-Am", value: "crew", emoji: "🏆", description: "Recrutement, test, team" },
      { label: "Signalement", value: "signalement", emoji: "🚨", description: "Signaler un membre" },
      { label: "Partenariat", value: "partenaire", emoji: "🤝", description: "Demande de partenariat" },
      { label: "Support", value: "support", emoji: "🛠️", description: "Autre demande" }
    );

  await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}

async function createTicket(interaction, type) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!TICKET_CATEGORY_ID) return interaction.editReply("❌ TICKET_CATEGORY_ID manque dans Railway.");
    if (!STAFF_ROLE_ID) return interaction.editReply("❌ STAFF_ROLE_ID manque dans Railway.");

    const guild = interaction.guild;
    const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
    if (!category) return interaction.editReply("❌ Catégorie ticket introuvable.");

    const ticketLabels = {
      boutique: "🛒 Boutique",
      vip: "👑 VIP",
      paypal: "💳 Paiement PayPal",
      nba: "🏀 NBA 2K",
      crew: "🏆 Crew / Pro-Am",
      signalement: "🚨 Signalement",
      partenaire: "🤝 Partenariat",
      support: "🛠️ Support"
    };

    const ticketQuestions = {
      boutique: "🛒 **Boutique**\n\n• Tu veux acheter quoi ?\n• VIP normal ou lifetime ?\n• Tu as déjà payé ?\n• Envoie une preuve si tu as payé.",
      vip: "👑 **VIP**\n\n• VIP normal ou lifetime ?\n• Tu n’as pas reçu ton rôle ?\n• Ton pseudo Discord ?\n• Preuve de paiement si tu as payé.",
      paypal: "💳 **Paiement PayPal**\n\n• Paiement envoyé ou bloqué ?\n• Montant envoyé ?\n• Capture PayPal si possible.\n• Pays de la personne qui envoie.",
      nba: "🏀 **NBA 2K**\n\n• Build / poste / taille\n• Jump shot / dribble / insignes\n• Problème en jeu\n• Envoie un screen si possible.",
      crew: "🏆 **Crew / Pro-Am**\n\n• Ton poste\n• Ton niveau / OVR\n• Tes dispos\n• Ton expérience Pro-Am / REC.",
      signalement: "🚨 **Signalement**\n\n• Pseudo de la personne\n• Ce qu’il a fait\n• Preuve obligatoire\n• Salon/date si possible.",
      partenaire: "🤝 **Partenariat**\n\n• Nom du serveur\n• Nombre de membres\n• Thème\n• Ce que tu proposes.",
      support: "🛠️ **Support**\n\nExplique ton problème clairement."
    };

    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "user";
    const ticketName = `ticket-${type}-${safeName}`;

    const alreadyOpen = guild.channels.cache.find(c =>
      c.parentId === TICKET_CATEGORY_ID &&
      c.name.includes(safeName) &&
      c.name.startsWith("ticket-")
    );

    if (alreadyOpen) return interaction.editReply(`❌ Tu as déjà un ticket ouvert : ${alreadyOpen}`);

    const staffRole = await guild.roles.fetch(STAFF_ROLE_ID).catch(() => null);

    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      }
    ];

    if (staffRole) {
      permissionOverwrites.push({
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
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites,
      topic: `Ticket ouvert par ${interaction.user.tag}`
    });

    const embed = new EmbedBuilder()
      .setTitle(ticketLabels[type] || "🎫 Ticket")
      .setDescription(
        `${interaction.user}\n\n${ticketQuestions[type] || ticketQuestions.support}\n\n` +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        "📌 Merci de tout expliquer en un seul message.\n" +
        "🔒 Seul le staff peut fermer le ticket."
      )
      .setColor(0x8b00ff)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: "Le Terrain des Rois • Support" })
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Fermer")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: `${staffRole ? `<@&${STAFF_ROLE_ID}>` : ""} ${interaction.user}`,
      embeds: [embed],
      components: [closeRow]
    });

    await sendLog(guild, "🎫 Ticket créé", `${interaction.user.tag} a ouvert ${ticketChannel}`, 0x00ff00);

    return interaction.editReply(`✅ Ton ticket a été créé : ${ticketChannel}`);
  } catch (err) {
    console.error("Erreur création ticket :", err);
    return interaction.editReply("❌ Erreur pendant la création du ticket. Regarde les logs Railway.");
  }
}

async function postReglement() {
  if (!REGLEMENT_CHANNEL_ID) return;
  const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (messages && messages.some(m => m.embeds[0]?.title?.includes("ACCÈS AU SERVEUR"))) return;

  const embed = new EmbedBuilder()
    .setTitle("👑 LE TERRAIN DES ROIS — ACCÈS AU SERVEUR")
    .setDescription(
      "🏀 **Bienvenue sur Le Terrain des Rois**\n\n" +
      "✅ Respect obligatoire\n🚫 Pas de spam / pub sauvage\n🏀 Utilise les bons salons\n💸 Arnaques interdites\n🛡️ Respect du staff\n🔥 Bonne ambiance\n\n" +
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
  if (!member || !MEMBER_ROLE_ID) return;

  await member.roles.add(MEMBER_ROLE_ID).catch(() => {});
});

client.on("guildMemberAdd", async (member) => {
  const channel = await member.guild.channels.fetch(process.env.WELCOME_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👑 Nouveau membre !")
    .setDescription(`Bienvenue ${member} sur **Le Terrain des Rois** !`)
    .setColor(0x8b00ff)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

async function sendAutoQuestion() {
  const channel = await client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const questions = [
    "🔥 Tu préfères 99 dunk ou 99 tir à 3 points ?",
    "🏀 Tu joues Park, REC ou Pro-Am ?",
    "👑 Prime LeBron, Prime Jordan ou Prime Kobe ?",
    "🎯 Drop ton build NBA 2K en screen 👇",
    "⚡ Qui est chaud pour jouer ce soir ?"
  ];

  const q = questions[Math.floor(Math.random() * questions.length)];

  const embed = new EmbedBuilder()
    .setTitle("🏀 QUESTION DU JOUR")
    .setDescription(`**${q}**`)
    .setColor(0x8b00ff)
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

async function sendMiniEvent() {
  const channel = await client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🎉 MINI EVENT")
    .setDescription("🎬 Drop ton meilleur clip NBA 2K. Le meilleur gagne **VIP 24h** 👑")
    .setColor(0x9b00ff)
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

async function sendBusinessPost() {
  const channel = await client.channels.fetch(RECOMPENSES_CHANNEL_ID || EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🎁 COMMENT GAGNER DES RÉCOMPENSES ?")
    .setDescription("👥 Invite des amis\n🎬 Poste des clips\n🏀 Participe aux events\n🔥 Sois actif dans le chat")
    .setColor(0xffd700)
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

async function sendGiveaway(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎁 GIVEAWAY VIP")
    .setDescription("Réagis avec 🎉 pour participer.\n\n🎁 Gain : **VIP 7 jours**")
    .setColor(0xffd700)
    .setTimestamp();

  const msg = await channel.send({ content: getEventPing(), embeds: [embed] });
  await msg.react("🎉").catch(() => {});
}

async function checkNBA2KNews() {
  if (!NEWS_CHANNEL_ID) return;
  const channel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  try {
    const feed = await parser.parseURL("https://store.steampowered.com/feeds/news/app/3472040/");

    for (const item of feed.items.slice(0, 3).reverse()) {
      if (postedNews.has(item.link)) continue;
      postedNews.add(item.link);

      const embed = new EmbedBuilder()
        .setTitle("🏀 NBA 2K26 — NOUVELLE ACTU")
        .setDescription(cleanText(item.contentSnippet || item.content || item.summary) || "Nouvelle actualité NBA 2K26.")
        .setURL(item.link)
        .setColor(0xff7a00)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.log("Erreur news :", err.message);
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
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USERNAME || !ANNOUNCE_CHANNEL_ID) return;
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
        .setDescription(`**${TWITCH_USERNAME} est en live !**\n\n📺 https://www.twitch.tv/${TWITCH_USERNAME}`)
        .setColor(0x9146ff)
        .setTimestamp();

      await channel.send({ content: "@everyone 🔴 **LIVE LANCÉ !**", embeds: [embed] });
    }

    if (!live && wasLive) {
      wasLive = false;
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
  await checkNBA2KNews();
  await checkTwitchLive();

  setInterval(checkNBA2KNews, 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);
  setInterval(sendMiniEvent, 8 * 60 * 60 * 1000);
  setInterval(sendBusinessPost, 24 * 60 * 60 * 1000);
});

client.login(process.env.TOKEN)
  .then(() => console.log("🔑 Login Discord OK"))
  .catch((err) => console.error("❌ ERREUR LOGIN DISCORD:", err));
