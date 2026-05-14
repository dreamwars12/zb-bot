const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔧 TON SERVEUR FIVEM
const SERVER_IP = "game02.octoheberg.fr:30144";

async function getPlayers() {
  try {
    const res = await fetch(`http://${SERVER_IP}/players.json`);
    const data = await res.json();
    return data.length;
  } catch (err) {
    console.log("Erreur FiveM:", err);
    return null;
  }
}

client.once("ready", () => {
  console.log(`Bot connecté : ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!players") {
    const count = await getPlayers();

    if (count === null) {
      return message.reply("❌ Impossible de récupérer les joueurs.");
    }

    message.reply(`👥 Il y a actuellement **${count} joueurs** en ligne.`);
  }
});

client.login(process.env.TOKEN);
