require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
} = require("discord.js");

const fs = require("fs");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

const SUPPORT_LINK = "discord.gg/pikpa";
const DATA_FILE = "./data.json";

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

client.once("ready", () => {
    console.log(`Bot online as ${client.user.tag}`);
});


// =========================
// 🔥 AUTO SUPPORTER ROLE (ONLY ADD)
// =========================
client.on("presenceUpdate", async (oldPresence, newPresence) => {
    try {
        const member = newPresence?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const activities = newPresence?.activities || [];
        const customStatus = activities.find(a => a.type === 4);

        const text = (customStatus?.state || "").toLowerCase();

        if (text.includes(SUPPORT_LINK)) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
            }
        }

    } catch (err) {
        console.error(err);
    }
});


// =========================
// 🟢 /vanitycheck (UI + IDs)
// =========================
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        if (message.content === "/vanitycheck") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return;

            await message.guild.members.fetch();

            let checked = 0;
            let added = 0;
            let removed = 0;

            let addedUsers = [];
            let removedUsers = [];

            const role = message.guild.roles.cache.get(process.env.ROLE_ID);

            for (const [, member] of message.guild.members.cache) {
                if (member.user.bot) continue;

                checked++;

                const presence = member.presence;
                const activity = presence?.activities?.find(a => a.type === 4);

                const text = (activity?.state || "").toLowerCase();
                const hasSupport = text.includes(SUPPORT_LINK);

                if (hasSupport) {
                    if (role && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role);
                        added++;
                        addedUsers.push(`${member.user.tag} (${member.id})`);
                    }
                } else {
                    if (role && member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                        removed++;
                        removedUsers.push(`${member.user.tag} (${member.id})`);
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle("⚡ VANITY CHECK REPORT")
                .setColor("#00ff99")
                .addFields(
                    { name: "👥 Checked", value: `${checked}`, inline: true },
                    { name: "➕ Added", value: `${added}`, inline: true },
                    { name: "➖ Removed", value: `${removed}`, inline: true }
                )
                .setFooter({ text: "System Auto Report • Support Bot" });

            if (addedUsers.length)
                embed.addFields({ name: "➕ Added Users", value: addedUsers.slice(0, 10).join("\n") });

            if (removedUsers.length)
                embed.addFields({ name: "➖ Removed Users", value: removedUsers.slice(0, 10).join("\n") });

            message.channel.send({ embeds: [embed] });
        }


        // =========================
        // 🏆 /winner (UI + buttons + ID log)
        // =========================
        if (message.content.startsWith("/winner")) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return;

            const user = message.mentions.users.first();
            if (!user) return message.reply("Mention a user");

            const args = message.content.split(" ");
            const amount = args[2] || "1";
            const giveawayName = args.slice(3).join(" ") || "Unknown Giveaway";

            let data = loadData();

            if (!data[user.id]) {
                data[user.id] = { wins: 0, prize: 0, history: [] };
            }

            data[user.id].wins += 1;
            data[user.id].prize += parseFloat(amount);
            data[user.id].history.push({
                prize: amount,
                giveaway: giveawayName,
                date: new Date().toISOString()
            });

            saveData(data);

            const logChannel = message.guild.channels.cache.get("1514526513045835846");

            const embed = new EmbedBuilder()
                .setTitle("🏆 WINNER CONFIRMED")
                .setColor("Gold")
                .addFields(
                    { name: "👤 Winner", value: `${user} (${user.id})` },
                    { name: "💰 Prize", value: `$${amount}` },
                    { name: "🎁 Giveaway", value: giveawayName }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Vouch Link")
                    .setStyle(ButtonStyle.Link)
                    .setURL("https://discord.com/channels/1450787742219767861/1506457793132232774")
            );

            if (logChannel)
                logChannel.send({ embeds: [embed], components: [row] });

            // DM user
            user.send({
                content: `🎉 You won **$${amount}** in **${giveawayName}**`,
                components: [row]
            }).catch(() => {});

            message.reply("✅ Winner logged successfully");
        }


        // =========================
        // 📊 /history
        // =========================
        if (message.content.startsWith("/history")) {
            const user = message.mentions.users.first() || message.author;

            let data = loadData();
            const info = data[user.id];

            if (!info) return message.reply("No history found.");

            message.channel.send(
                `📊 **${user.username} History**\n🏆 Wins: ${info.wins}\n💰 Total: $${info.prize}`
            );
        }


        // =========================
        // 🥇 /leaderboard
        // =========================
        if (message.content === "/leaderboard") {
            let data = loadData();

            const sorted = Object.entries(data)
                .sort((a, b) => b[1].wins - a[1].wins)
                .slice(0, 10);

            let text = "🏆 **LEADERBOARD**\n\n";

            for (const [id, info] of sorted) {
                text += `<@${id}> — Wins: ${info.wins} | $${info.prize}\n`;
            }

            message.channel.send(text);
        }


        // =========================
        // 📈 /stats
        // =========================
        if (message.content === "/stats") {
            const guild = message.guild;

            let data = loadData();

            const supporters = guild.members.cache.filter(m =>
                m.roles.cache.has(process.env.ROLE_ID)
            ).size;

            const totalWinners = Object.keys(data).length;

            let totalPayout = 0;
            for (const id in data) {
                totalPayout += data[id].prize;
            }

            message.channel.send(
                `📊 **SERVER STATS**
👥 Members: ${guild.memberCount}
💎 Supporters: ${supporters}
🏆 Winners: ${totalWinners}
💰 Total Payout: $${totalPayout}`
            );
        }

    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.TOKEN);
