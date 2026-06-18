async function checkTwitchLive() {
  try {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_USERNAME) {
      console.log("❌ Variables Twitch manquantes");
      return;
    }

    if (!twitchToken) await getTwitchToken();

    const res = await axios.get(
      "https://api.twitch.tv/helix/streams?user_login=" + TWITCH_USERNAME,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: "Bearer " + twitchToken
        }
      }
    );

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

  await postReglement();
  await checkNBA2KNews(false);
  await checkTwitchLive();

  setInterval(() => checkNBA2KNews(false), 10 * 60 * 1000);
  setInterval(checkTwitchLive, 60 * 1000);
});

client.login(process.env.TOKEN);
