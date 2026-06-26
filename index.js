async function sendTicketPanel(channel) {
  if (!channel) return;

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
  }).catch(console.error);
}

async function createTicket(interaction, type) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!TICKET_CATEGORY_ID) {
      return interaction.editReply("❌ TICKET_CATEGORY_ID manque dans Railway.");
    }

    if (!STAFF_ROLE_ID) {
      return interaction.editReply("❌ STAFF_ROLE_ID manque dans Railway.");
    }

    const guild = interaction.guild;
    const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);

    if (!category) {
      return interaction.editReply("❌ La catégorie ticket est introuvable. Vérifie TICKET_CATEGORY_ID.");
    }

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
      boutique:
        "🛒 **Boutique**\n\n" +
        "Réponds à ça :\n" +
        "• Tu veux acheter quoi ?\n" +
        "• VIP normal ou lifetime ?\n" +
        "• Tu as déjà payé ?\n" +
        "• Envoie une preuve si tu as payé.",

      vip:
        "👑 **VIP**\n\n" +
        "Réponds à ça :\n" +
        "• VIP normal ou lifetime ?\n" +
        "• Tu n’as pas reçu ton rôle ?\n" +
        "• Ton pseudo Discord ?\n" +
        "• Preuve de paiement si tu as payé.",

      paypal:
        "💳 **Paiement PayPal**\n\n" +
        "Explique le problème :\n" +
        "• Paiement envoyé ou bloqué ?\n" +
        "• Montant envoyé ?\n" +
        "• Capture PayPal si possible.\n" +
        "• Pays de la personne qui envoie l’argent.",

      nba:
        "🏀 **NBA 2K**\n\n" +
        "Dis exactement ce que tu veux :\n" +
        "• Build / poste / taille\n" +
        "• Jump shot / dribble / insignes\n" +
        "• Problème en jeu\n" +
        "• Envoie un screen si possible.",

      crew:
        "🏆 **Crew / Pro-Am**\n\n" +
        "Présente-toi :\n" +
        "• Ton poste\n" +
        "• Ton niveau / OVR\n" +
        "• Tes dispos\n" +
        "• Ton expérience Pro-Am / REC.",

      signalement:
        "🚨 **Signalement**\n\n" +
        "Envoie :\n" +
        "• Pseudo de la personne\n" +
        "• Ce qu’il a fait\n" +
        "• Preuve obligatoire\n" +
        "• Salon/date si possible.",

      partenaire:
        "🤝 **Partenariat**\n\n" +
        "Présente ton serveur :\n" +
        "• Nom\n" +
        "• Nombre de membres\n" +
        "• Thème du serveur\n" +
        "• Ce que tu proposes.",

      support:
        "🛠️ **Support**\n\n" +
        "Explique ton problème clairement.\n" +
        "Un staff va te répondre."
    };

    const safeName = interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || "user";

    const ticketName = `ticket-${type}-${safeName}`;

    const alreadyOpen = guild.channels.cache.find(c =>
      c.parentId === TICKET_CATEGORY_ID &&
      c.name.includes(safeName) &&
      c.name.startsWith("ticket-")
    );

    if (alreadyOpen) {
      return interaction.editReply(`❌ Tu as déjà un ticket ouvert : ${alreadyOpen}`);
    }

    const staffRole = await guild.roles.fetch(STAFF_ROLE_ID).catch(() => null);

    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
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
      topic: `Ticket ouvert par ${interaction.user.tag} | Catégorie: ${ticketLabels[type] || type}`
    });

    const embed = new EmbedBuilder()
      .setTitle(ticketLabels[type] || "🎫 Ticket")
      .setDescription(
        `${interaction.user}\n\n` +
        `${ticketQuestions[type] || ticketQuestions.support}\n\n` +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        "📌 Merci de tout expliquer en un seul message.\n" +
        "🔒 Seul le staff peut fermer le ticket."
      )
      .setColor(0x8b00ff)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
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

    await sendLog(
      guild,
      "🎫 Ticket créé",
      `${interaction.user.tag} a ouvert ${ticketChannel} catégorie **${ticketLabels[type] || type}**`,
      0x00ff00
    );

    return interaction.editReply(`✅ Ton ticket a été créé : ${ticketChannel}`);
  } catch (err) {
    console.error("Erreur création ticket :", err);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("❌ Erreur pendant la création du ticket. Regarde les logs Railway.");
    }

    return interaction.reply({
      content: "❌ Erreur pendant la création du ticket.",
      ephemeral: true
    });
  }
}
