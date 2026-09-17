const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const data = new SlashCommandBuilder().setName('help').setDescription('Lista todos los comandos del bot');

async function execute(interaction) {
  // Requerido aquí dentro (no arriba del archivo) para evitar un ciclo: registry.js requiere
  // este mismo módulo, y este módulo necesita la lista completa de registry.js.
  const { commandModules } = require('./registry');

  const lines = commandModules.map((command) => {
    const json = command.data.toJSON();
    return `\`/${json.name}\` — ${json.description}`;
  });

  const value = lines.join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📖 Comandos disponibles')
    .setColor(0x5865f2)
    // Discord corta los valores de campo en 1024 caracteres; con ~15 comandos esto puede
    // rozar el límite.
    .addFields({ name: '⚔️ League of Legends / General', value: value.length > 1024 ? `${value.slice(0, 1000)}…` : value });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute };
