const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

async function askLearningStyle(interaction) {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('learn_book_first')
        .setLabel('Book First, Then Apply')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📚'),
      new ButtonBuilder()
        .setCustomId('learn_visual')
        .setLabel('Visual Learner')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎥')
    );

  await interaction.followUp({
    content: 'What\'s your learning style?',
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

module.exports = { askLearningStyle };