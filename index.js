```js
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
  const t = title.toLowerCase();
  if (t.includes("patch notes")) return "Notes de mise à jour NBA 2K26";
  if (t.includes("season") && t.includes("courtside report")) return "Rapport officiel de saison NBA 2K26";
  if (t.includes("festival")) return "Événement spécial NBA 2K26";
  if (t.includes("event")) return "Nouvel événement NBA 2K26";
  return title;
}

function explainNews(title, text) {
  const c = `${title} ${text}`.toLowerCase();
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
    embeds.push(
      new EmbedBuilder()
        .setImage(TICKET_BANNER_URL)
        .setColor(0x8b00ff)
    );
  }

  const embed = new EmbedBuilder()
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
    .setTimestamp();

  embeds.push(embed);

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("🎫 Choisis le type de ticket")
    .addOptions(
      {
        label: "Support",
        description: "Problème général ou question",
        value: "support",
        emoji: "🛠️"
      },
      {
        label: "Signalement",
        description: "Signaler un joueur ou comportement",
        value: "signalement",
        emoji: "🚨"
      },
      {
        label: "Pro-Am",
        description: "Recrutement équipe Pro-Am",
        value: "proam",
        emoji: "🏀"
      },
      {
        label: "Partenariat",
        description: "Demande de partenariat",
        value: "partenaire",
        emoji: "🤝"
      }
    );

  const row = new ActionRowBuilder().addComponents(menu);

  await channel.send({
    embeds,
    components: [row]
  });
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;

  const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
  if (!category) {
    return interaction.reply({
      content: "❌ Catégorie ticket introuvable. Vérifie TICKET_CATEGORY_ID.",
      ephemeral: true
    });
  }

  const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const ticketName = `ticket-${type}-${username}`;

  const existing = guild.channels.cache.find(c => c.name === ticketName);
  if (existing) {
    return interaction.reply({
      content: `❌ Tu as déjà un ticket : ${existing}`,
      ephemeral: true
    });
  }

  const ticketChannel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages
        ]
      }
    ]
  });

  const questions = {
    support: "Explique ton problème avec le plus de détails possible.",
    signalement: "Envoie le pseudo du joueur, une preuve et explique la situation.",
    proam: "Présente ton poste, ton build, ton niveau et tes disponibilités.",
    partenaire: "Présente ton serveur/chaîne, tes stats et ce que tu proposes."
  };

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket ${type.toUpperCase()}`)
    .setDescription(
      `Salut ${interaction.user} 👋\n\n` +
      `${questions[type] || "Explique ta demande clairement."}\n\n` +
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

  await ticketChannel.send({
    content: `<@&${STAFF_ROLE_ID}> ${interaction.user}`,
    embeds: [embed],
    components: [row]
  });

  await sendLog(guild, "🎫 Ticket créé", `${interaction.user.tag} a ouvert ${ticketChannel}.`, 0x00ff00);

  return interaction.reply({
    content: `✅ Ticket créé : ${ticketChannel}`,
    ephemeral: true
  });
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content.toLowerCase() === "!ticketpanel") {
    if (!isStaff(message.member)) {
      return message.reply("❌ Tu dois être staff pour envoyer le panel ticket.");
    }

    return sendTicketPanel(message.channel);
  }

  if (message.content.toLowerCase() === "!rolespanel") {
    return postRolesPanel(message.channel);
  }

  if (isStaff(message.member)) return;

  if (/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(message.content)) {
    await message.delete().catch(() => {});
    await message.member.timeout(15 * 60 * 1000, "Pub Discord interdite").catch(() => {});
    return sendLog(message.guild, "🚫 Pub Discord bloquée", `${message.author.tag} a envoyé une invitation dans ${message.channel}.`, 0xff0000);
  }

  if (message.mentions.everyone || message.mentions.users.size >= 5 || message.mentions.roles.size >= 3) {
    await message.delete().catch(() => {});
    await message.member.timeout(20 * 60 * 1000, "Mass mention").catch(() => {});
    return sendLog(message.guild, "🚨 Anti-mass mention", `${message.author.tag} a fait trop de mentions.`, 0xff0000);
  }

  const now = Date.now();
  const id = message.author.id;
  const list = (spamMap.get(id) || []).filter(t => now - t < 5000);

  list.push(now);
  spamMap.set(id, list);

  if (list.length >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(10 * 60 * 1000, "Spam rapide").catch(() => {});
    return sendLog(message.guild, "⚠️ Anti-spam", `${message.author.tag} a spam.`, 0xffaa00);
  }
});

client.on("guildMemberAdd", async (member) => {
  const age = Date.now() - member.user.createdTimestamp;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  await sendLog(member.guild, "👤 Nouveau membre", `${member.user.tag} a rejoint le serveur.`, 0x00ff00);

  if (age < sevenDays) {
    await sendLog(member.guild, "🔒 Anti-alt", `${member.user.tag} a un compte de moins de 7 jours.`, 0xff0000);
  }
});

client.on("guildMemberRemove", async (member) => {
  await sendLog(member.guild, "📤 Départ", `${member.user.tag} a quitté le serveur.`, 0xffaa00);
});

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

client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_select") {
      const type = interaction.values[0];
      return createTicket(interaction, type);
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === "close_ticket") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Seul le staff peut fermer ce ticket.", ephemeral: true });
    }

    await interaction.reply("🔒 Ticket fermé dans 5 secondes.");
    await sendLog(interaction.guild, "🔒 Ticket fermé", `${interaction.user.tag} a fermé ${interaction.channel}.`, 0xffaa00);

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);

    return;
  }

  const roleNames = {
    role_playmaker: "🏀 Playmaker",
    role_lock: "🔒 Lock",
    role_shooter: "🏹 Shooter",
    role_big: "💪 Big Man"
  };

  if (!roleNames[interaction.customId]) return;

  let role = interaction.guild.roles.cache.find(r => r.name === roleNames[interaction.customId]);

  if (!role) {
    role = await interaction.guild.roles.create({ name: roleNames[interaction.customId] }).catch(() => null);
  }

  if (!role) {
    return interaction.reply({ content: "Impossible de créer/trouver le rôle.", ephemeral: true });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    await interaction.member.roles.remove(role);
    return interaction.reply({ content: `Rôle retiré : ${role.name}`, ephemeral: true });
  }

  await interaction.member.roles.add(role);
  return interaction.reply({ content: `Rôle ajouté : ${role.name}`, ephemeral: true });
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
        `📢 **${titreFR}**\n` +
        `🌍 *Titre original : ${item.title}*\n\n` +
        `📝 **Résumé :**\n${resume || "Le flux ne donne pas beaucoup de texte."}\n\n` +
        `💡 **Explication rapide :**\n${explication}\n\n` +
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
        new ButtonBuilder().setLabel("Rejoindre le live").setStyle(ButtonStyle.Link).setURL(`https://www.twitch.tv/${TWITCH_USERNAME}`)
      );

      await channel.send({
        content: "@everyone 🔴 **LIVE LANCÉ !**",
        embeds: [embed],
        components: [button]
      });
    }

    if (!live && wasLive) wasLive = false;
  } catch (err) {
    console.log("Erreur Twitch :", err.message);
    twitchToken = null;
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot complet connecté : ${client.user.tag}`);

  await postReglement();
  await checkNBA2KNews(false);

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);
});

client.login(process.env.TOKEN);
```
