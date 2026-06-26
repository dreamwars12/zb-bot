async function sendTicketPanel(channel) {
  const embeds = [];

  if (TICKET_BANNER_URL) {
    embeds.push(new EmbedBuilder().setImage(TICKET_BANNER_URL).setColor(0x8b00ff));
  }

  embeds.push(
    new EmbedBuilder()
      .setTitle("🎫 CENTRE SUPPORT — LE TERRAIN DES ROIS")
      .setDescription(
        "Choisis la bonne catégorie pour ouvrir un ticket.\n\n" +
        "🛒 **Boutique** — achat, paiement, commande\n" +
        "👑 **VIP** — rôle VIP, lifetime, avantages\n" +
        "🏀 **NBA 2K** — build, insignes, animations, Pro-Am\n" +
        "🚨 **Signalement** — problème avec un membre\n" +
        "🤝 **Partenariat** — demande de partenariat\n" +
        "🛠️ **Support général** — autre problème\n\n" +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        "⚠️ Ouvre un ticket seulement si tu as une vraie demande."
      )
      .setColor(0x8b00ff)
      .setFooter({ text: "Le Terrain des Rois • Tickets" })
      .setTimestamp()
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("🎫 Choisis une catégorie")
    .addOptions(
      {
        label: "Boutique",
        description: "Achat, paiement PayPal, commande",
        value: "boutique",
        emoji: "🛒"
      },
      {
        label: "VIP",
        description: "VIP normal, lifetime, rôle non reçu",
        value: "vip",
        emoji: "👑"
      },
      {
        label: "NBA 2K",
        description: "Build, insignes, animations, Pro-Am",
        value: "nba",
        emoji: "🏀"
      },
      {
        label: "Signalement",
        description: "Signaler un membre avec preuve",
        value: "signalement",
        emoji: "🚨"
      },
      {
        label: "Partenariat",
        description: "Demande de partenariat serveur",
        value: "partenaire",
        emoji: "🤝"
      },
      {
        label: "Support général",
        description: "Autre problème ou question",
        value: "support",
        emoji: "🛠️"
      }
    );

  await channel.send({
    embeds,
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}

async function createTicket(interaction, type) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
  if (!category) return interaction.editReply("❌ Catégorie ticket introuvable.");

  const ticketLabels = {
    boutique: "🛒 Boutique",
    vip: "👑 VIP",
    nba: "🏀 NBA 2K",
    signalement: "🚨 Signalement",
    partenaire: "🤝 Partenariat",
    support: "🛠️ Support"
  };

  const ticketQuestions = {
    boutique:
      "🛒 **Boutique**\n\n" +
      "Merci de répondre à ces questions :\n" +
      "• Tu veux acheter quoi ?\n" +
      "• VIP normal ou lifetime ?\n" +
      "• Tu payes par PayPal ?\n" +
      "• Envoie une preuve si tu as déjà payé.",

    vip:
      "👑 **VIP**\n\n" +
      "Explique ta demande :\n" +
      "• VIP normal ou lifetime ?\n" +
      "• Tu as déjà payé ?\n" +
      "• Tu n’as pas reçu ton rôle ?\n" +
      "• Envoie ton pseudo Discord + preuve de paiement.",

    nba:
      "🏀 **NBA 2K**\n\n" +
      "Explique ton problème :\n" +
      "• Ton poste / taille / build\n" +
      "• Ce que tu veux améliorer\n" +
      "• Build, jump shot, dribble, insignes ou Pro-Am ?\n" +
      "• Envoie un screen si possible.",

    signalement:
      "🚨 **Signalement**\n\n" +
      "Envoie tout clairement :\n" +
      "• Pseudo de la personne\n" +
      "• Ce qu’il a fait\n" +
      "• Screen / preuve obligatoire\n" +
      "• Date ou salon où c’est arrivé.",

    partenaire:
      "🤝 **Partenariat**\n\n" +
      "Présente ton serveur :\n" +
      "• Nom du serveur\n" +
      "• Nombre de membres\n" +
      "• Type de communauté\n" +
      "• Ce que tu proposes en échange.",

    support:
      "🛠️ **Support général**\n\n" +
      "Explique ton problème clairement.\n" +
      "Un staff va venir t’aider dès que possible."
  };

  const username = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 12);

  const ticketName = `ticket-${type}-${username}`;

  const existing = guild.channels.cache.find(
    c => c.name === ticketName && c.parentId === TICKET_CATEGORY_ID
  );

  if (existing) {
    return interaction.editReply(`❌ Tu as déjà un ticket ouvert : ${existing}`);
  }

  const overwrites = [
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
    permissionOverwrites: overwrites,
    topic: `Ticket ${ticketLabels[type]} ouvert par ${interaction.user.tag}`
  });

  const embed = new EmbedBuilder()
    .setTitle(`${ticketLabels[type] || "🎫 Ticket"}`)
    .setDescription(
      `${interaction.user}\n\n` +
      `${ticketQuestions[type] || ticketQuestions.support}\n\n` +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "📌 **Merci de ne pas spam.**\n" +
      "🔒 Un staff fermera le ticket quand la demande sera terminée."
    )
    .setColor(0x8b00ff)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: "Le Terrain des Rois • Support" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Fermer le ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${staffRole ? staffRole.toString() : ""} ${interaction.user}`,
    embeds: [embed],
    components: [row]
  });

  await sendLog(
    guild,
    "🎫 Ticket créé",
    `${interaction.user.tag} a ouvert ${ticketChannel} catégorie **${ticketLabels[type]}**`,
    0x00ff00
  );

  return interaction.editReply(`✅ Ton ticket a été créé : ${ticketChannel}`);
}
