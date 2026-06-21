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

async function sendLog(guild, title, description, color) {
  if (!LOG_CHANNEL_ID) return;
  const channel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color || 0x8b00ff)
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
  if (t.includes("season") && t.includes("courtside report")) return "Rapport officiel de saison NBA 2K26";
  if (t.includes("festival")) return "Événement spécial NBA 2K26";
  if (t.includes("event")) return "Nouvel événement NBA 2K26";
  return title || "Actualité NBA 2K26";
}

function explainNews(title, text) {
  const c = (String(title || "") + " " + String(text || "")).toLowerCase();

  if (c.includes("patch") || c.includes("notes")) return "Mise à jour : corrections, gameplay, bugs ou stabilité.";
  if (c.includes("season")) return "Nouvelle saison : récompenses, niveaux, événements, vêtements ou contenus MyCAREER/MyTEAM.";
  if (c.includes("festival") || c.includes("event")) return "Événement limité : XP, VC, récompenses ou défis.";
  if (c.includes("myteam")) return "Actu MyTEAM : cartes, packs, défis ou récompenses.";
  if (c.includes("mycareer") || c.includes("city")) return "Actu MaCarrière / Ville : quêtes, récompenses ou événements.";
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
      "✅ **Respect obligatoire**\nAucune insulte grave, menace ou harcèlement.\n\n" +
      "🚫 **Spam / Pub interdit**\nPas de flood, pub sauvage, liens suspects ou arnaques.\n\n" +
      "🏀 **Utilise les bons salons**\nBuilds, Pro-Am, clips, actus, annonces, FiveM, Fortnite.\n\n" +
      "💸 **Arnaques interdites**\nVC fake, faux giveaways, vente de comptes ou scams = sanction.\n\n" +
      "🛡️ **Respect du staff**\nLes décisions du staff doivent être respectées.\n\n" +
      "🔥 **Bonne ambiance**\nReste chill, aide les autres et profite du serveur.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ **Clique sur ✅ pour accepter le règlement et débloquer les salons.**"
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Règlement officiel" })
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

async function sendTicketPanel(channel) {
  const embeds = [];

  if (TICKET_BANNER_URL) {
    embeds.push(new EmbedBuilder().setImage(TICKET_BANNER_URL).setColor(0x8b00ff));
  }

  embeds.push(
    new EmbedBuilder()
      .setTitle("🎫 CENTRE D’AIDE — LE TERRAIN DES ROIS")
      .setDescription(
        "Bienvenue dans le **support officiel**.\n\n" +
        "Sélectionne une catégorie dans le menu ci-dessous pour ouvrir un ticket.\n\n" +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        "🛠️ **Support** — problème général\n" +
        "🚨 **Signalement** — tricheur / comportement toxique\n" +
        "🏀 **Pro-Am** — recrutement équipe\n" +
        "🤝 **Partenariat** — collaboration\n" +
        "━━━━━━━━━━━━━━━━━━━━━━"
      )
      .setColor(0x8b00ff)
      .setFooter({ text: "Le Terrain des Rois • Tickets" })
      .setTimestamp()
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("🎫 Choisis le type de ticket")
    .addOptions(
      { label: "Support", description: "Problème général ou question", value: "support", emoji: "🛠️" },
      { label: "Signalement", description: "Signaler un joueur ou comportement", value: "signalement", emoji: "🚨" },
      { label: "Pro-Am", description: "Recrutement équipe Pro-Am", value: "proam", emoji: "🏀" },
      { label: "Partenariat", description: "Demande de partenariat", value: "partenaire", emoji: "🤝" }
    );

  const row = new ActionRowBuilder().addComponents(menu);
  await channel.send({ embeds, components: [row] });
}

async function createTicket(interaction, type) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);

    if (!category) return interaction.editReply("❌ Catégorie ticket introuvable. Vérifie TICKET_CATEGORY_ID.");

    const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const ticketName = "ticket-" + type + "-" + username;

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
      support: "Explique ton problème avec le plus de détails possible.",
      signalement: "Envoie le pseudo du joueur, une preuve et explique la situation.",
      proam: "Présente ton poste, ton build, ton niveau et tes disponibilités.",
      partenaire: "Présente ton serveur/chaîne, tes stats et ce que tu proposes."
    };

    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket " + type.toUpperCase())
      .setDescription(
        "Salut " + interaction.user.toString() + " 👋\n\n" +
        (questions[type] || "Explique ta demande clairement.") + "\n\n" +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        "📌 **Règles :**\n" +
        "• Pas de spam\n" +
        "• Pas d’insultes\n" +
        "• Explique clairement\n" +
        "• Attends le staff\n" +
        "━━━━━━━━━━━━━━━━━━━━━━"
      )
      .setColor(0x8b00ff)
      .setFooter({ text: "Le Terrain des Rois • Support" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Fermer")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    );

    const ping = staffRole ? staffRole.toString() + " " : "";

    await ticketChannel.send({
      content: ping + interaction.user.toString(),
      embeds: [embed],
      components: [row]
    });

    await sendLog(guild, "🎫 Ticket créé", interaction.user.tag + " a ouvert " + ticketChannel.toString() + ".", 0x00ff00);
    return interaction.editReply("✅ Ticket créé : " + ticketChannel.toString());
  } catch (err) {
    console.log("Erreur createTicket :", err.message);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("❌ Erreur ticket : " + err.message).catch(() => {});
    }
  }
}

async function postRolesPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🏀 RÔLES NBA 2K26")
    .setDescription("Choisis ton rôle principal avec les boutons ci-dessous.")
    .setColor(0xff7a00);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("role_playmaker").setLabel("Playmaker").setEmoji("🎯").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_lock").setLabel("Lock").setEmoji("🔒").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_shooter").setLabel("Shooter").setEmoji("🏹").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_big").setLabel("Big Man").setEmoji("💪").setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function sendAutoQuestion() {
  const channel = await client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const questions = [
    "Tu joues quel poste sur NBA 2K26 ?",
    "Drop ton build en screen 👇",
    "Qui est chaud Pro-Am ce soir ?",
    "Tu préfères dunker ou shooter à 3 points ?",
    "C’est qui ton joueur NBA préféré ?",
    "Tu joues plutôt Park, REC ou Pro-Am ?",
    "Ton meilleur insigne sur NBA 2K c’est quoi ?",
    "Tu préfères meneur dribbleur ou ailier shooter ?"
  ];

  const q = questions[Math.floor(Math.random() * questions.length)];

  const embed = new EmbedBuilder()
    .setTitle("🏀 QUESTION DU JOUR")
    .setDescription("**" + q + "**\n\nRéponds dans le chat 👇")
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Activité auto" })
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

async function sendMiniEvent() {
  const channel = await client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const events = [
    "🎬 Drop ton meilleur clip NBA 2K, le meilleur gagne un rôle spécial 24h 👑",
    "🏀 Mini-event : qui est chaud pour un tournoi 1v1 ce soir ?",
    "🔥 Envoie ton meilleur build, le plus propre gagne 👑",
    "🎯 Défi du jour : poste ton meilleur shoot clutch !",
    "👥 Objectif serveur : invite un pote, on vise les 100 membres !",
    "💎 Montre ton outfit NBA 2K, le plus stylé gagne 👑",
    "📸 Envoie ton meilleur screen en jeu, le staff choisit le gagnant."
  ];

  const event = events[Math.floor(Math.random() * events.length)];

  const embed = new EmbedBuilder()
    .setTitle("🎉 MINI EVENT")
    .setDescription("**" + event + "**\n\nParticipe maintenant 👇")
    .setColor(0x9b00ff)
    .setFooter({ text: "Le Terrain des Rois • Event auto" })
    .setTimestamp();

  await channel.send({ content: getEventPing(), embeds: [embed] });
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content.toLowerCase() === "!ticketpanel") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff pour envoyer le panel ticket.");
    return sendTicketPanel(message.channel);
  }

  if (message.content.toLowerCase() === "!rolespanel") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return postRolesPanel(message.channel);
  }

  if (message.content.toLowerCase() === "!question") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return sendAutoQuestion();
  }

  if (message.content.toLowerCase() === "!event") {
    if (!isStaff(message.member)) return message.reply("❌ Tu dois être staff.");
    return sendMiniEvent();
  }

  if (isStaff(message.member)) return;

  if (/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(message.content)) {
    await message.delete().catch(() => {});
    await message.member.timeout(15 * 60 * 1000, "Pub Discord interdite").catch(() => {});
    return sendLog(message.guild, "🚫 Pub Discord bloquée", message.author.tag + " a envoyé une invitation dans " + message.channel.toString() + ".", 0xff0000);
  }

  const now = Date.now();
  const id = message.author.id;
  const list = (spamMap.get(id) || []).filter(t => now - t < 5000);
  list.push(now);
  spamMap.set(id, list);

  if (list.length >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(10 * 60 * 1000, "Spam rapide").catch(() => {});
    return sendLog(message.guild, "⚠️ Anti-spam", message.author.tag + " a spam.", 0xffaa00);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    return createTicket(interaction, interaction.values[0]);
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === "close_ticket") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Seul le staff peut fermer ce ticket.", ephemeral: true });
    }

    await interaction.reply("🔒 Ticket fermé dans 5 secondes.");
    await sendLog(interaction.guild, "🔒 Ticket fermé", interaction.user.tag + " a fermé " + interaction.channel.toString() + ".", 0xffaa00);

    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
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
        "📢 **" + titreFR + "**\n" +
        "🌍 *Titre original : " + item.title + "*\n\n" +
        "📝 **Résumé :**\n" + (resume || "Le flux ne donne pas beaucoup de texte.") + "\n\n" +
        "💡 **Explication rapide :**\n" + explication + "\n\n" +
        "🎯 **À surveiller :** récompenses, événements, patchs, VC, XP ou nouveautés."
      )
      .setURL(item.link)
      .setColor(0xff7a00)
      .setFooter({ text: "Le Terrain des Rois • NBA 2K26 Actus" })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Lire l’article complet").setStyle(ButtonStyle.Link).setURL(item.link)
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
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USERNAME) {
      console.log("❌ Variables Twitch manquantes");
      return;
    }

    if (!twitchToken) await getTwitchToken();

    const res = await axios.get("https://api.twitch.tv/helix/streams?user_login=" + TWITCH_USERNAME, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: "Bearer " + twitchToken
      }
    });

    const live = res.data.data[0];
    console.log("TWITCH LIVE =", live ? "OUI" : "NON");

    if (live && !wasLive) {
      wasLive = true;

      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
      if (!channel) {
        console.log("❌ Salon annonce introuvable");
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🔴 LIVE TWITCH LANCÉ !")
        .setDescription(
          "**" + TWITCH_USERNAME + " est en live maintenant !**\n\n" +
          "🎮 **Jeu :** " + (live.game_name || "Gaming") + "\n" +
          "📌 **Titre :** " + (live.title || "Live en cours") + "\n\n" +
          "📺 https://www.twitch.tv/" + TWITCH_USERNAME
        )
        .setImage(live.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"))
        .setColor(0x9146ff)
        .setFooter({ text: "Le Terrain des Rois • Twitch Live" })
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

      console.log("✅ Annonce Twitch envoyée");
    }

    if (!live && wasLive) {
      wasLive = false;

      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle("⚫ LIVE TERMINÉ")
          .setDescription("Le live Twitch de **" + TWITCH_USERNAME + "** est terminé.\nMerci à ceux qui sont passés 💜")
          .setColor(0x2b2d31)
          .setFooter({ text: "Le Terrain des Rois • Twitch" })
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
      }

      console.log("🔴 Live terminé");
    }
  } catch (err) {
    console.log("❌ Erreur Twitch :", err.response?.data || err.message);
    twitchToken = null;
  }
}

client.once("ready", async () => {
  console.log("✅ Bot complet connecté : " + client.user.tag);
  console.log("TWITCH_USERNAME =", TWITCH_USERNAME);
  console.log("TWITCH_CLIENT_ID OK =", !!TWITCH_CLIENT_ID);
  console.log("TWITCH_CLIENT_SECRET OK =", !!TWITCH_CLIENT_SECRET);
  console.log("ANNOUNCE_CHANNEL_ID =", ANNOUNCE_CHANNEL_ID);
  console.log("EVENT_CHANNEL_ID =", EVENT_CHANNEL_ID);

  await postReglement();
  await checkNBA2KNews(false);
  await checkTwitchLive();

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);

  setInterval(sendAutoQuestion, 6 * 60 * 60 * 1000);
  setInterval(sendMiniEvent, 12 * 60 * 60 * 1000);
});

client.login(process.env.TOKEN);
