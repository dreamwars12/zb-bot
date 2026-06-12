const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const Parser = require("rss-parser");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const parser = new Parser();

const NEWS_CHANNEL_ID = process.env.CHANNEL_ID;
const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;

let postedLinks = new Set();

async function postReglement() {
  const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 20 });
  const alreadyPosted = messages.some(msg =>
    msg.embeds[0]?.title === "📜 Règlement du serveur"
  );

  if (alreadyPosted) return;

  const embed = new EmbedBuilder()
    .setTitle("📜 Règlement du serveur")
    .setDescription(
      "Bienvenue sur **Le Terrain des Rois** 🏀\n\n" +
      "Merci de respecter les règles ci-dessous pour garder un serveur propre et agréable."
    )
    .addFields(
      { name: "1️⃣ Respect", value: "Aucune insulte grave, menace, harcèlement ou provocation abusive." },
      { name: "2️⃣ Spam interdit", value: "Pas de spam, flood, pub sauvage ou messages inutiles." },
      { name: "3️⃣ Salon adapté", value: "Utilise les bons salons pour parler de NBA 2K26, builds, événements, actus, etc." },
      { name: "4️⃣ Pas d’arnaque", value: "Interdit de vendre, scam, fake giveaway ou promettre des VC gratuits." },
      { name: "5️⃣ Respect du staff", value: "Les décisions du staff doivent être respectées." },
      { name: "6️⃣ Bonne ambiance", value: "Le serveur est fait pour parler NBA 2K26, aider les joueurs et s’amuser." }
    )
    .setColor(0x8a2be2)
    .setFooter({ text: "Le Terrain des Rois • Règlement officiel" })
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

      const embed = new EmbedBuilder()
        .setTitle("🏀 Nouvelle actualité NBA 2K26")
        .setDescription(`**${item.title}**\n\nClique sur le bouton/titre pour voir l'article complet.`)
        .setURL(item.link)
        .setColor(0xff7a00)
        .addFields(
          { name: "🎮 Jeu", value: "NBA 2K26", inline: true },
          { name: "📰 Type", value: "Actualité / Mise à jour", inline: true }
        )
        .setThumbnail("https://cdn.cloudflare.steamstatic.com/steam/apps/3472040/header.jpg")
        .setFooter({ text: "NBA 2K26 Actualités • Mise à jour automatique" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.log("Erreur actu NBA 2K26 :", err.message);
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  await postReglement();

  await checkNBA2KNews();
  setInterval(checkNBA2KNews, 10 * 60 * 1000);
});

client.login(process.env.TOKEN);
