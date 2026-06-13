const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  SlashCommandBuilder
} = require("discord.js");

const Parser = require("rss-parser");
const axios = require("axios");
const fs = require("fs");
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
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

const TWITCH_USERNAME = process.env.TWITCH_USERNAME;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let postedNews = new Set();
let twitchToken = null;
let wasLive = false;
let spamMap = new Map();
let joinTimes = [];

const warnsFile = "./warns.json";
if (!fs.existsSync(warnsFile)) fs.writeFileSync(warnsFile, "{}");

function loadWarns() {
  return JSON.parse(fs.readFileSync(warnsFile, "utf8"));
}

function saveWarns(data) {
  fs.writeFileSync(warnsFile, JSON.stringify(data, null, 2));
}

function isStaff(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(STAFF_ROLE_ID);
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
  const c = `${title} ${text}`.toLowerCase();

  if (c.includes("patch") || c.includes("notes")) return "Mise à jour : corrections, gameplay, bugs, stabilité ou changements dans certains modes.";
  if (c.includes("season")) return "Nouvelle saison : récompenses, niveaux, événements, vêtements, animations ou contenus MyCAREER/MyTEAM.";
  if (c.includes("festival") || c.includes("event")) return "Événement limité : XP, VC, récompenses spéciales ou défis pendant une durée limitée.";
  if (c.includes("myteam")) return "Actu MyTEAM : cartes, packs, défis, récompenses ou événements.";
  if (c.includes("mycareer") || c.includes("city")) return "Actu MaCarrière / Ville : quêtes, récompenses, événements ou nouveautés joueur.";
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
      "✅ **Respect obligatoire**\nAucune insulte grave, menace, harcèlement ou provocation abusive.\n\n" +
      "🚫 **Spam / Pub interdit**\nPas de flood, pub sauvage, liens suspects ou arnaques.\n\n" +
      "🏀 **Utilise les bons salons**\nBuilds, Pro-Am, clips, actus, annonces, FiveM, Fortnite.\n\n" +
      "💸 **Arnaques interdites**\nVC fake, faux giveaways, vente de comptes ou scams = sanction.\n\n" +
      "🛡️ **Respect du staff**\nLes décisions du staff doivent être respectées.\n\n" +
      "🔥 **Bonne ambiance**\nReste chill, aide les autres et profite du serveur.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ **Clique sur ✅ pour accepter le règlement et débloquer les salons.**"
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Vérification officielle" })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed] });
  await msg.react("✅").catch(() => {});
}

async function postTicketPanel() {
  const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🎫 SUPPORT — LE TERRAIN DES ROIS")
    .setDescription(
      "Besoin d’aide ? Ouvre un ticket avec le bouton adapté.\n\n" +
      "🛠️ **Support**\n" +
      "🚨 **Signaler un tricheur**\n" +
      "🏀 **Recrutement Pro-Am**\n" +
      "🤝 **Partenariat**"
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Tickets" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_support").setLabel("Support").setEmoji("🛠️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket_tricheur").setLabel("Tricheur").setEmoji("🚨").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_proam").setLabel("Pro-Am").setEmoji("🏀").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ticket_partenaire").setLabel("Partenariat").setEmoji("🤝").setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function postRolesPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🏀 RÔLES NBA 2K26")
    .setDescription("Choisis ton rôle principal :")
    .setColor(0xff7a00);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("role_playmaker").setLabel("Playmaker").setEmoji("🎯").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_lock").setLabel("Lock").setEmoji("🔒").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_shooter").setLabel("Shooter").setEmoji("🏹").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_big").setLabel("Big Man").setEmoji("💪").setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const name = `ticket-${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

  const existing = guild.channels.cache.find(c => c.name === name);
  if (existing) return interaction.reply({ content: `Tu as déjà un ticket : ${existing}`, ephemeral: true });

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket ${type}`)
    .setDescription(`Bienvenue ${interaction.user}.\nUn membre du staff va te répondre.`)
    .setColor(0x8b00ff)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fermer le ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@&${STAFF_ROLE_ID}> ${interaction.user}`, embeds: [embed], components: [row] });
  await interaction.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
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

client.on("guildMemberAdd", async (member) => {
  const now = Date.now();
  joinTimes.push(now);
  while (joinTimes.length && now - joinTimes[0] > 30000) joinTimes.shift();

  const accountAge = now - member.user.createdTimestamp;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (WELCOME_CHANNEL_ID) {
    const welcome = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (welcome) {
      const embed = new EmbedBuilder()
        .setTitle("👋 Nouveau membre")
        .setDescription(`Bienvenue ${member} sur **Le Terrain des Rois** 👑\nVa accepter le règlement pour voir tous les salons.`)
        .setColor(0x8b00ff)
        .setTimestamp();
      welcome.send({ embeds: [embed] }).catch(() => {});
    }
  }

  await sendLog("👤 Nouveau membre", `${member.user.tag} vient de rejoindre.`, 0x00ff00);

  if (accountAge < sevenDays) {
    await sendLog("🔒 Anti-alt", `${member.user.tag} a un compte créé il y a moins de 7 jours.`, 0xff0000);
  }

  if (joinTimes.length >= 8) {
    await sendLog("🚨 ALERTE RAID", `${joinTimes.length} membres ont rejoint en 30 secondes.`, 0xff0000);
  }
});

client.on("guildMemberRemove", async (member) => {
  await sendLog("📤 Départ", `${member.user.tag} a quitté le serveur.`, 0xffaa00);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === "!ticketpanel" && isStaff(message.member)) return postTicketPanel();
  if (message.content === "!rolespanel" && isStaff(message.member)) return postRolesPanel(message.channel);

  if (isStaff(message.member)) return;

  const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i;

  if (inviteRegex.test(message.content)) {
    await message.delete().catch(() => {});
    return sendLog("🚫 Invitation bloquée", `${message.author.tag} a envoyé une invitation Discord dans ${message.channel}.`);
  }

  if (message.mentions.everyone || message.mentions.users.size >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(10 * 60 * 1000, "Anti-mass mention").catch(() => {});
    return sendLog("🚨 Anti-mass mention", `${message.author.tag} a fait trop de mentions. Mute 10 minutes.`);
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
    return sendLog("⚠️ Anti-spam", `${message.author.tag} a été mute 5 minutes pour spam.`);
  }
});

client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;
  await sendLog("🗑️ Message supprimé", `Auteur : ${message.author?.tag || "Inconnu"}\nSalon : ${message.channel}\nMessage : ${message.content || "Vide"}`, 0xffaa00);
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
      .setThumbnail("https://cdn.cloudflare.steamstatic.com/steam/apps/3472040/header.jpg")
      .setFooter({ text: "Le Terrain des Rois • NBA 2K26 Actus" })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Lire l’article complet").setStyle(ButtonStyle.Link).setURL(item.link)
    );

    await channel.send({ embeds: [embed], components: [button] });
  }
}

async function getTwitchToken() {
  const res = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`);
  twitchToken = res.data.access_token;
}

async function checkTwitchLive() {
  try {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USERNAME) return;
    if (!twitchToken) await getTwitchToken();

    const res = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${twitchToken}`
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

      await channel.send({ content: "@everyone 🔴 **LIVE LANCÉ !**", embeds: [embed], components: [button] });
    }

    if (!live && wasLive) {
      wasLive = false;
      await sendLog("📴 Live terminé", `Le live Twitch de ${TWITCH_USERNAME} est terminé.`, 0x9146ff);
    }
  } catch (err) {
    console.log("Erreur Twitch :", err.message);
    twitchToken = null;
  }
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("ticket_")) {
      const type = interaction.customId.replace("ticket_", "");
      return createTicket(interaction, type);
    }

    if (interaction.customId === "close_ticket") {
      if (!isStaff(interaction.member)) return interaction.reply({ content: "Tu n’as pas la permission.", ephemeral: true });
      await interaction.reply("Ticket fermé dans 5 secondes.");
      return setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    const roleNames = {
      role_playmaker: "🏀 Playmaker",
      role_lock: "🔒 Lock",
      role_shooter: "🏹 Shooter",
      role_big: "💪 Big Man"
    };

    if (roleNames[interaction.customId]) {
      let role = interaction.guild.roles.cache.find(r => r.name === roleNames[interaction.customId]);
      if (!role) role = await interaction.guild.roles.create({ name: roleNames[interaction.customId] }).catch(() => null);
      if (!role) return interaction.reply({ content: "Impossible de créer/trouver le rôle.", ephemeral: true });

      if (interaction.member.roles.cache.has(role.id)) {
        await interaction.member.roles.remove(role);
        return interaction.reply({ content: `Rôle retiré : ${role.name}`, ephemeral: true });
      } else {
        await interaction.member.roles.add(role);
        return interaction.reply({ content: `Rôle ajouté : ${role.name}`, ephemeral: true });
      }
    }
  }

  if (!interaction.isChatInputCommand()) return;
  if (!isStaff(interaction.member)) return interaction.reply({ content: "Tu n’as pas la permission.", ephemeral: true });

  const target = interaction.options.getMember("membre");
  const reason = interaction.options.getString("raison") || "Aucune raison";

  if (interaction.commandName === "warn") {
    const warns = loadWarns();
    if (!warns[target.id]) warns[target.id] = [];
    warns[target.id].push({ reason, mod: interaction.user.tag, date: new Date().toLocaleString("fr-FR") });
    saveWarns(warns);
    await sendLog("⚠️ Warn", `${target.user.tag} a été warn.\nRaison : ${reason}`);
    return interaction.reply(`${target} a été warn.`);
  }

  if (interaction.commandName === "warnings") {
    const warns = loadWarns();
    const list = warns[target.id] || [];
    return interaction.reply({ content: `${target.user.tag} a ${list.length} warn(s).\n${list.map((w, i) => `${i + 1}. ${w.reason}`).join("\n") || "Aucun warn."}`, ephemeral: true });
  }

  if (interaction.commandName === "unwarn") {
    const warns = loadWarns();
    warns[target.id] = [];
    saveWarns(warns);
    return interaction.reply(`Warns supprimés pour ${target}.`);
  }

  if (interaction.commandName === "mute") {
    const minutes = interaction.options.getInteger("minutes") || 10;
    await target.timeout(minutes * 60 * 1000, reason);
    return interaction.reply(`${target} mute ${minutes} minutes.`);
  }

  if (interaction.commandName === "unmute") {
    await target.timeout(null);
    return interaction.reply(`${target} unmute.`);
  }

  if (interaction.commandName === "kick") {
    await target.kick(reason);
    return interaction.reply(`${target.user.tag} kick.`);
  }

  if (interaction.commandName === "ban") {
    await target.ban({ reason });
    return interaction.reply(`${target.user.tag} ban.`);
  }
});

client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("warn").setDescription("Warn un membre").addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(o => o.setName("raison").setDescription("Raison")),
    new SlashCommandBuilder().setName("unwarn").setDescription("Retire les warns").addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true)),
    new SlashCommandBuilder().setName("warnings").setDescription("Voir les warns").addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true)),
    new SlashCommandBuilder().setName("mute").setDescription("Mute un membre").addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true)).addIntegerOption(o => o.setName("minutes").setDescription("Durée")).addStringOption(o => o.setName("raison").setDescription("Raison")),
    new SlashCommandBuilder().setName("unmute").setDescription("Unmute un membre").addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true)),
    new SlashCommandBuilder().setName("kick").setDescription("Kick un membre").addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(o => o.setName("raison").setDescription("Raison")),
    new SlashCommandBuilder().setName("ban").setDescription("Ban un membre").addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(o => o.setName("raison").setDescription("Raison"))
  ];

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands).catch(console.error);
  }

  await postReglement();
  await checkNBA2KNews(false);

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);
});

client.login(process.env.TOKEN);
