require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const fs = require("fs");

// =========================
// CLIENT
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages
    ],
    partials: ["CHANNEL"]
});

// =========================
// CONFIG
// =========================
const SUPPORT_LINK = "discord.gg/pikpa";

const WINNER_LOG_CHANNEL = "1514526513045835846";
const VOUCH_CHANNEL = "1512778450186932334";

// =========================
// DB SYSTEM
// =========================
const DB_FILE = "./data.json";

function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return {};
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// =========================
// READY
// =========================
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// =========================
// AUTO SUPPORTER ROLE
// =========================
client.on("presenceUpdate", async (_, newP) => {
    try {
        const member = newP?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const activities = newP?.activities || [];
        const status = activities.find(a => a.type === 4);

        const text = (status?.state || "").toLowerCase();

        if (text.includes(SUPPORT_LINK)) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(() => {});
            }
        }
    } catch (e) {
        console.error("role error:", e);
    }
});

// =========================
// SLASH COMMANDS
// =========================
const commands = [
    {
        name: "winner",
        description: "Log winner payout",
        options: [
            {
                name: "user",
                description: "Winner user",
                type: 6,
                required: true
            },
            {
                name: "amount",
                description: "Prize amount ($)",
                type: 10,
                required: true
            },
            {
                name: "note",
                description: "Optional note (can be empty)",
                type: 3,
                required: false
            }
        ]
    },
    {
        name: "history",
        description: "Check user win history",
        options: [
            {
                name: "user",
                description: "User",
                type: 6,
                required: false
            }
        ]
    },
    {
        name: "stats",
        description: "Server statistics"
    },
    {
        name: "vanitycheck",
        description: "Sync supporter roles"
    }
];

// =========================
// REGISTER COMMANDS
// =========================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );

        console.log("✅ Slash commands registered");
    } catch (err) {
        console.error("Command error:", err);
    }
});

// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        let db = loadDB();

        // =========================
        // 🏆 WINNER SYSTEM (PRO UI FIXED)
        // =========================
        if (interaction.commandName === "winner") {

            const user = interaction.options.getUser("user");
            const amount = interaction.options.getNumber("amount");

            // ✅ SAFE NOTE HANDLING (NO NULL EVER)
            const noteRaw = interaction.options.getString("note");
            const note = noteRaw && noteRaw.trim().length > 0 ? noteRaw : "No special note provided";

            if (!db[user.id]) {
                db[user.id] = { wins: 0, total: 0, history: [] };
            }

            db[user.id].wins += 1;
            db[user.id].total += amount;
            db[user.id].history.push({
                note,
                amount,
                time: Date.now()
            });

            saveDB(db);

            // =========================
            // 🏆 BEAUTIFUL LOG EMBED
            // =========================
            const logEmbed = new EmbedBuilder()
                .setTitle("🏆 WINNER DECLARED")
                .setColor("#FFD700")
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: "👤 Winner", value: `<@${user.id}>`, inline: true },
                    { name: "💰 Prize", value: `$${amount}`, inline: true },
                    { name: "🎁 Note", value: note, inline: false },
                    { name: "🆔 User ID", value: `${user.id}`, inline: false }
                )
                .setTimestamp();

            const logChannel = interaction.guild.channels.cache.get(WINNER_LOG_CHANNEL);
            if (logChannel) {
                logChannel.send({ embeds: [logEmbed] });
            }

            // =========================
            // 💰 BEAUTIFUL DM MESSAGE (YOUR STYLE)
            // =========================
            const dmEmbed = new EmbedBuilder()
                .setTitle("💰 Your payout has been successfully processed.")
                .setColor("#2ecc71")
                .setDescription(
                    `💰 **Prize:** $${amount}\n🎁 **Note:** ${note}\n\n🙏 Thank you for supporting our community!\nPlease vouch using the button below.`
                )
                .setFooter({ text: "Vanity Rewards System" });

            const dmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Vouch Now")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${interaction.guild.id}/${VOUCH_CHANNEL}`)
            );

            user.send({ embeds: [dmEmbed], components: [dmRow] }).catch(() => {});

            return interaction.reply({
                content: "✅ Winner successfully logged",
                ephemeral: true
            });
        }

        // =========================
        // 📜 HISTORY (CLEAN UI)
        // =========================
        if (interaction.commandName === "history") {

            const user = interaction.options.getUser("user") || interaction.user;
            const data = db[user.id];

            if (!data || !data.history?.length) {
                return interaction.reply({ content: "❌ No history found", ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📜 ${user.username} Win History`)
                .setColor("#3498db")
                .setThumbnail(user.displayAvatarURL())
                .setDescription(
                    data.history.map((h, i) =>
                        `**#${i + 1}**\n🎁 Note: ${h.note}\n💰 Amount: $${h.amount}`
                    ).join("\n\n")
                )
                .addFields(
                    { name: "🏆 Total Wins", value: `${data.wins}`, inline: true },
                    { name: "💰 Total Earned", value: `$${data.total}`, inline: true }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // =========================
        // 📊 STATS
        // =========================
        if (interaction.commandName === "stats") {

            const guild = interaction.guild;

            const supporters = guild.members.cache.filter(m =>
                m.roles.cache.has(process.env.ROLE_ID)
            ).size;

            let wins = 0;
            let total = 0;

            for (const id in db) {
                wins += db[id].wins || 0;
                total += db[id].total || 0;
            }

            const embed = new EmbedBuilder()
                .setTitle("📊 Server Statistics")
                .setColor("#00ffff")
                .addFields(
                    { name: "👥 Members", value: `${guild.memberCount}`, inline: true },
                    { name: "⭐ Supporters", value: `${supporters}`, inline: true },
                    { name: "🏆 Wins", value: `${wins}`, inline: true },
                    { name: "💰 Total Paid", value: `$${total}` }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // =========================
        // 🔥 VANITY CHECK (SYNC SYSTEM)
        // =========================
        if (interaction.commandName === "vanitycheck") {

            await interaction.reply({ content: "🔍 Syncing supporter roles...", ephemeral: true });

            const role = interaction.guild.roles.cache.get(process.env.ROLE_ID);
            if (!role) return;

            const members = await interaction.guild.members.fetch();

            let added = 0;
            let removed = 0;

            for (const member of members.values()) {

                const activities = member.presence?.activities || [];
                const status = activities.find(a => a.type === 4);

                const text = (status?.state || "").toLowerCase();
                const has = text.includes(SUPPORT_LINK);

                if (has) {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role).catch(() => {});
                        added++;
                    }
                } else {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role).catch(() => {});
                        removed++;
                    }
                }
            }

            return interaction.followUp({
                content: `✅ Vanity Sync Complete\n➕ Added: ${added}\n➖ Removed: ${removed}`,
                ephemeral: true
            });
        }

    } catch (err) {
        console.error(err);

        if (!interaction.replied) {
            interaction.reply({
                content: "❌ Something went wrong",
                ephemeral: true
            });
        }
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
