require("dotenv").config();
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const SUPPORT_LINK = "discord.gg/pikpa";

client.once("ready", () => {
    console.log("Supporter bot is online");
});


// ✅ GIVE ROLE FUNCTION
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
    if (message.author.bot) return;

    if (message.content === "!scanall") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const guild = message.guild;
        await guild.members.fetch();

        message.channel.send("🔍 Scanning members...");

        guild.members.cache.forEach(async (member) => {
            if (member.user.bot) return;

            const presence = member.presence;
            if (!presence) return; // ❌ skip offline users

            const activities = presence.activities || [];
            const customStatus = activities.find(a => a.type === 4);

            const text = (customStatus?.state || "").toLowerCase();

            if (text.includes(SUPPORT_LINK)) {
                await giveRole(member);
            }
        });

        message.channel.send("✅ Scan complete!");
    }
});

client.login(process.env.TOKEN);
