const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const curriculum = require('../ctf_curriculum_roadmap.json');

const CATEGORY_MAP = {
    web: 'web',
    crypto: 'crypto',
    forensics: 'forensics',
    re: 'reverse_engineering',
    pwn: 'binary_exploitation',
    osint: 'osint_misc'
};

const CATEGORY_TITLE = {
    web: 'Web Exploitation',
    crypto: 'Cryptography',
    forensics: 'Digital Forensics',
    re: 'Reverse Engineering',
    pwn: 'Binary Exploitation',
    osint: 'OSINT & Misc'
};

/**
 * Resolve which path object to use
 */
function resolvePath(catData, path) {
    const paths = catData.paths || {};

    // Prefer exact path if exists
    if (path === 'visual' && paths.visual) return { key: 'visual', data: paths.visual };
    if (path === 'book' && paths.book) return { key: 'book', data: paths.book };

    // Fallback to common
    if (paths.common) return { key: 'common', data: paths.common };

    // Last fallback: first available path
    const firstKey = Object.keys(paths)[0];
    return firstKey ? { key: firstKey, data: paths[firstKey] } : null;
}

/**
 * Normalize resources into [{ title, link }]
 */
function normalizeResources(resources, preferredPath = 'book') {
    if (!resources) return [];

    // Already an array
    if (Array.isArray(resources)) {
        return resources
            .map(r => ({
                title: r.title || 'Resource',
                link: r.link && !String(r.link).includes('PLACEHOLDER') ? r.link : null
            }))
            .filter(r => r.title);
    }

    // Object with book/visual/visual_and_practice
    if (typeof resources === 'object') {
        const preferred =
            resources[preferredPath] ||
            resources.visual_and_practice ||
            resources.visual ||
            resources.book;

        if (Array.isArray(preferred)) {
            return normalizeResources(preferred);
        }

        // Nested groups like tools (IDA, Ghidra...)
        const flat = [];
        for (const [group, items] of Object.entries(resources)) {
            if (Array.isArray(items)) {
                items.forEach(item => {
                    flat.push({
                        title: item.title || group,
                        link: item.link && !String(item.link).includes('PLACEHOLDER') ? item.link : null
                    });
                });
            }
        }
        return flat;
    }

    return [];
}

/**
 * Normalize topics into a short readable string
 */
function normalizeTopics(topics) {
    if (!topics) return null;

    if (Array.isArray(topics)) {
        return topics
            .slice(0, 8)
            .map(t => {
                if (typeof t === 'string') return `• ${t}`;
                if (t?.title) return t.link && !String(t.link).includes('PLACEHOLDER')
                    ? `• [${t.title}](${t.link})`
                    : `• ${t.title}`;
                return null;
            })
            .filter(Boolean)
            .join('\n')
            .slice(0, 1000);
    }

    if (typeof topics === 'object') {
        return Object.entries(topics)
            .slice(0, 5)
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    const preview = value
                        .slice(0, 3)
                        .map(v => (typeof v === 'string' ? v : v.title || 'item'))
                        .join(', ');
                    return `**${key}:** ${preview}`;
                }
                return `**${key}:** ${String(value)}`;
            })
            .join('\n')
            .slice(0, 1000);
    }

    return null;
}

/**
 * Main function
 * @param {string} category bot category: web|crypto|forensics|re|pwn|osint
 * @param {string} path 'book' | 'visual'
 * @param {number} stageIndex
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[], meta: object }}
 */
function getRoadmapEmbed(category, path = 'book', stageIndex = 0) {
    const jsonCategory = CATEGORY_MAP[category];
    const title = CATEGORY_TITLE[category] || category;

    const catData = curriculum.categories.find(c => c.category === jsonCategory);

    if (!catData) {
        return {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('Roadmap not found')
                    .setDescription(`No curriculum for **${category}**.`)
            ],
            components: [],
            meta: { category, path, stageIndex, totalStages: 0 }
        };
    }

    const resolved = resolvePath(catData, path);
    if (!resolved) {
        return {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(`${title} Roadmap`)
                    .setDescription('No path data found.')
            ],
            components: [],
            meta: { category, path, stageIndex, totalStages: 0 }
        };
    }

    const stages = resolved.data.stages || [];
    const safeIndex = Math.max(0, Math.min(stageIndex, stages.length - 1));
    const stage = stages[safeIndex];

    const embed = new EmbedBuilder()
        .setColor(path === 'visual' ? 0xc6ff33 : 0x6952ea)
        .setTitle(`${title} • ${stage.title || `Stage ${safeIndex + 1}`}`)
        .setFooter({
            text: `Stage ${safeIndex + 1}/${stages.length} • Path: ${resolved.key} • Underdogs Pack`
        });

    if (stage.description) {
        embed.setDescription(stage.description.slice(0, 4000));
    }

    const topicsText = normalizeTopics(stage.topics);
    if (topicsText) {
        embed.addFields({ name: 'Topics', value: topicsText });
    }

    const resources = normalizeResources(stage.resources, path);
    if (resources.length) {
        const resourceText = resources
            .slice(0, 8)
            .map(r => (r.link ? `• [${r.title}](${r.link})` : `• ${r.title}`))
            .join('\n')
            .slice(0, 1000);

        embed.addFields({ name: 'Resources', value: resourceText || 'No resources yet' });
    }

    if (Array.isArray(stage.sequence) && stage.sequence.length) {
        embed.addFields({
            name: 'Suggested Order',
            value: stage.sequence
                .slice(0, 5)
                .map((s, i) => `**${i + 1}.** ${s}`)
                .join('\n')
                .slice(0, 1000)
        });
    }

    if (stage.note) {
        embed.addFields({ name: 'Note', value: String(stage.note).slice(0, 1000) });
    }

    if (Array.isArray(stage.notes) && stage.notes.length) {
        embed.addFields({
            name: 'Notes',
            value: stage.notes.slice(0, 4).map(n => `• ${n}`).join('\n').slice(0, 1000)
        });
    }

    // Navigation buttons
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`roadmap_prev:${category}:${path}:${safeIndex}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safeIndex <= 0),

        new ButtonBuilder()
            .setCustomId(`roadmap_next:${category}:${path}:${safeIndex}`)
            .setLabel('Next Stage')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(safeIndex >= stages.length - 1),

        new ButtonBuilder()
            .setCustomId(`roadmap_switch:${category}:${path}:${safeIndex}`)
            .setLabel(path === 'visual' ? 'Switch to Book Path' : 'Switch to Visual Path')
            .setStyle(ButtonStyle.Success)
    );

    return {
        embeds: [embed],
        components: [row],
        meta: {
            category,
            path: resolved.key === 'common' ? path : resolved.key,
            stageIndex: safeIndex,
            totalStages: stages.length
        }
    };
}

module.exports = { getRoadmapEmbed };