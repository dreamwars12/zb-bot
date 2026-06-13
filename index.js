const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const Parser = require("rss-parser");
const axios = require("axios");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const parser = new Parser();

const NEWS_CHANNEL_ID = process.env.CHANNEL_ID;
const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;

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

  if (c.includes("patch") || c.includes("notes")) {
    return "Mise à jour : corrections, gameplay, bugs, stabilité ou changements dans certains modes.";
  }

  if (c.includes("season")) {
    return "Nouvelle saison : récompenses, niveaux, événements, vêtements, animations ou contenus MyCAREER/MyTEAM.";
  }

  if (c.includes("festival") || c.includes("event")) {
    return "Événement limité : XP, VC, récompenses spéciales ou défis pendant une durée limitée.";
  }

  if (c.includes("myteam")) return "Actu MyTEAM : cartes, packs, défis, récompenses ou événements.";
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
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === "!rolespanel") {
    return postRolesPanel(message.channel);
  }
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
  if (!interaction.isButton()) return;

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

    if (!live && wasLive) {
      wasLive = false;
    }
  } catch (err) {
    console.log("Erreur Twitch :", err.message);
    twitchToken = null;
  }
}

client.once("ready", async () => {
  console.log(`✅ Premier bot connecté : ${client.user.tag}`);

  await postReglement();
  await checkNBA2KNews(false);

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);
});

client.login(process.env.TOKEN);
