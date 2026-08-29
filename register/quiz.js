const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');

async function startQuiz(interaction) {
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('category_select')
    .setPlaceholder('Choose your category')
    .addOptions([
      { label: 'Web Security', value: 'web', description: 'Web application security' },
      { label: 'Binary Exploitation', value: 'binary', description: 'Reverse engineering & exploitation' },
      { label: 'Cryptography', value: 'crypto', description: 'Encryption & decryption' },
      { label: 'Forensics', value: 'forensics', description: 'Digital forensics' },
    ]);

  const row = new ActionRowBuilder().addComponents(categorySelect);

  await interaction.followUp({
    content: 'Select your primary learning category:',
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

async function handleCategorySelect(interaction) {
  const category = interaction.values[0];
  
  // Assign role based on category
  const roleMap = {
    'web': 'Web Security',
    'binary': 'Binary Exploitation',
    'crypto': 'Cryptography',
    'forensics': 'Forensics'
  };
  
  const role = interaction.guild.roles.cache.find(r => r.name === roleMap[category]);
  if (role) await interaction.member.roles.add(role);

  // Store in database (implement with your preferred DB)
  // await db.users.update({ category, userId: interaction.user.id });

  // Continue to learning style
  const { askLearningStyle } = require('./learningStyle');
  await askLearningStyle(interaction);
}

module.exports = { startQuiz, handleCategorySelect };