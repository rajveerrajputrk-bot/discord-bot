require("dotenv").config();
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const SUPPORT_LINK = "discord.gg/pikpa";

client.once("ready", () => {
    console.log("Supporter bot is online");
});


// ✅ ROLE FUNCTION
async function giveRole(member) {
    const role = member.guild.roles.cache.get(process.env.ROLE_ID);
    if (!role) return;

    if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        console.log(`+ Role added: ${member.user.tag}`);
    }
}


// 🔥 COMMAND: !scanall
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;
        if (message.content !== "!scanall") return;

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ No permission");
        }

        const guild = message.guild;

        await guild.members.fetch();

        message.channel.send("🔍 Scanning members...");

        let count = 0;

        for (const [, member] of guild.members.cache) {
            if (member.user.bot) continue;

            const presence = member.presence;
            if (!presence) continue; // offline skip

            const activity = presence.activities?.find(a => a.type === 4);
            const text = (activity?.state || "").toLowerCase();

            if (text.includes(SUPPORT_LINK)) {
                await giveRole(member);
                count++;
            }
        }

        message.channel.send(`✅ Scan complete! Roles updated: ${count}`);

    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.TOKEN);
