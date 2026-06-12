const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const Parser = require("rss-parser");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const parser = new Parser();

const NEWS_CHANNEL_ID = process.env.CHANNEL_ID;
const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;

let postedLinks = new Set();

function cleanText(text) {
  if (!text) return "Aucun résumé disponible pour cette actualité.";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .slice(0, 900);
}

async function postReglement() {
  const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("📜 RÈGLEMENT OFFICIEL")
    .setDescription(
      "Bienvenue sur **Le Terrain des Rois** 🏀\n\n" +
      "Lis bien le règlement avant de parler sur le serveur."
    )
    .addFields(
      { name: "👑 Respect", value: "Respecte tous les membres. Aucune insulte grave, menace ou harcèlement." },
      { name: "🚫 Pub / Spam", value: "Pub, spam, flood et liens suspects interdits." },
      { name: "🏀 NBA 2K26", value: "Parle dans les bons salons : builds, actus, événements, clips, aide." },
      { name: "💸 Arnaques interdites", value: "Interdit de vendre des VC fake, comptes, glitchs ou faux giveaways." },
      { name: "🛡️ Staff", value: "Le staff peut sanctionner si tu ne respectes pas les règles." },
      { name: "🔥 Ambiance", value: "Reste chill, aide les joueurs et profite du serveur." }
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • NBA 2K26" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

async function checkNBA2KNews() {
  try {
    const channel = await client.channels.fetch(NEWS_CHANNEL_ID);
    if (!channel) return;

    const feed = await parser.parseURL("https://store.steampowered.com/feeds/news/app/3472040/");

    for (const item of feed.items.slice(0, 5).reverse()) {
      if (postedLinks.has(item.link)) continue;
      postedLinks.add(item.link);

      const resume = cleanText(item.contentSnippet || item.content || item.summary);

      const embed = new EmbedBuilder()
        .setTitle(`🏀 ${item.title}`)
        .setURL(item.link)
        .setDescription(
          `**Nouvelle actualité NBA 2K26 !**\n\n` +
          `📰 **Résumé :**\n${resume}`
        )
        .addFields(
          { name: "🎮 Jeu", value: "NBA 2K26", inline: true },
          { name: "📢 Catégorie", value: "Actu / Update", inline: true }
        )
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
  } catch (err) {
    console.log("Erreur actu NBA 2K26 :", err.message);
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  await postReglement();

  const feed = await parser.parseURL("https://store.steampowered.com/feeds/news/app/3472040/");
  feed.items.slice(0, 5).forEach(item => postedLinks.add(item.link));

  setInterval(checkNBA2KNews, 10 * 60 * 1000);
});

client.login(process.env.TOKEN);
