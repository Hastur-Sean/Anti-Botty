
var fs = require('fs');

process.on('unhandledRejection', (reason) => {
  console.error(reason);
  process.exit(1);
});
try {
	var Discord = require("discord.js");
} catch (e){
	console.log(e.stack);
	console.log(process.version);
	console.log("Please run npm install and ensure it passes with no errors!"); // if there is an error, tell to install dependencies.
	process.exit();
}
console.log("Starting DiscordBot\nNode version: " + process.version + "\nDiscord.js version: " + Discord.version); // send message notifying bot boot-up

var mentionBot = '<@459597823680446469>'

// Get authentication data
try {
	var AuthDetails = require("./auth.json");
} catch (e){
	console.log("Please create an auth.json like auth.json.example with a bot token or an email and password.\n"+e.stack); // send message for error - no token 
	process.exit(); 
}

// Load custom permissions
var dangerousCommands = ["eval","pullanddeploy","setUsername","cmdauth"]; // set array if dangerous commands
var Permissions = {};
try{
	Permissions = require("./permissions.json");
} catch(e){
	Permissions.global = {};
	Permissions.users = {};
}

for( var i=0; i<dangerousCommands.length;i++ ){
	var cmd = dangerousCommands[i];
	if(!Permissions.global.hasOwnProperty(cmd)){
		Permissions.global[cmd] = false;
	}
}
Permissions.checkPermission = function (userid,permission){
	//var usn = user.username + "#" + user.discriminator;
	//console.log("Checking " + permission + " permission for " + usn);
	try {
		var allowed = true;
		try{
			if(Permissions.global.hasOwnProperty(permission)){
				allowed = Permissions.global[permission] === true;
			}
		} catch(e){}
		try{
			if(Permissions.users[userid].hasOwnProperty("*")){
				allowed = Permissions.users[userid]["*"] === true;
			}
			if(Permissions.users[userid].hasOwnProperty(permission)){
				allowed = Permissions.users[userid][permission] === true;
			}
		} catch(e){}
		return allowed;
	} catch(e){}
	return false;
}
fs.writeFile("./permissions.json",JSON.stringify(Permissions,null,2), (err) => {
	if(err) console.error(err);
});

//load config data
var Config = {};
try{
	Config = require("./config.json");
} catch(e){ //no config file, use defaults
	Config.debug = false;
	Config.commandPrefix = '.';
	try{
		if(fs.lstatSync("./config.json").isFile()){ // open config file
			console.log("WARNING: config.json found but we couldn't read it!\n" + e.stack); // corrupted config file
		}
	} catch(e2){
		fs.writeFile("./config.json",JSON.stringify(Config,null,2), (err) => {
			if(err) console.error(err);
		});
	}
}
if(!Config.hasOwnProperty("commandPrefix")){
	Config.commandPrefix = '.'; // set bots prefix
}

var messagebox;
var aliases;
try{
	aliases = require("./alias.json");
} catch(e) {
	//No aliases defined
	aliases = {};
}

commands = {	// all commands list below
	"alias": {
		usage: "<name> <actual command>",
		description: "Creates command aliases. Useful for making simple commands on the fly",
		process: function(bot,msg,suffix) {
			var args = suffix.split(" ");
			var name = args.shift();
			if(!name){
				msg.channel.send(Config.commandPrefix + "alias " + this.usage + "\n" + this.description);
			} else if(commands[name] || name === "help"){
				msg.channel.send("overwriting commands with aliases is not allowed!");
			} else {
				var command = args.shift();
				aliases[name] = [command, args.join(" ")];
				//now save the new alias
				require("fs").writeFile("./alias.json",JSON.stringify(aliases,null,2), null);
				msg.channel.send("created alias " + name);
			}
		}
	},
	"aliases": {
		description: "lists all recorded aliases",
		process: function(bot, msg, suffix) {
			var text = "current aliases:\n";
			for(var a in aliases){
				if(typeof a === 'string')
					text += a + " ";
			}
			msg.channel.send(text);
		}
	},
    "say": {
        usage: "<message>",
        description: "bot says message",
        process: function(bot,msg,suffix){
			msg.delete().catch(O_o=>{});
			 msg.channel.send(suffix);
			}
    },
	"msg": {
		usage: "<user> <message to leave user>",
		description: "leaves a message for a user the next time they come online",
		process: function(bot,msg,suffix) {
			var args = suffix.split(' ');
			var user = args.shift();
			var message = args.join(' ');
			if(user.startsWith('<@')){
				user = user.substr(2,user.length-3);
			}
			var target = msg.channel.guild.members.find("id",user);
			if(!target){
				target = msg.channel.guild.members.find("username",user);
			}
			messagebox[target.id] = {
				channel: msg.channel.id,
				content: target + ", " + msg.author + " said: " + message
			};
			updateMessagebox();
			msg.channel.send("message saved.")
		}
	},
	"cmdauth": {
		usage: "<userid> <get/toggle> <command>",
		description: "Gets/Toggles command usage permission for the specified user",
		process: function(bot,msg,suffix) {
			var Permissions = require("./permissions.json");
			var fs = require('fs');

			var args = suffix.split(' ');
			var userid = args.shift();
			var action = args.shift();
			var cmd = args.shift();

			if(userid.startsWith('<@')){
				userid = userid.substr(2,userid.length-3);
			}

			var target = msg.channel.guild.members.find("id",userid);
			if(!target) {
				msg.channel.send("Could not find user");
			} else {
				if(commands[cmd] || cmd === "*") {
					var canUse = Permissions.checkPermission(userid,cmd);
					var strResult;
					if(cmd === "*") {
						strResult = "all commands"
					} else {
						strResult = 'command "' + cmd + '"';
					}
					if(action.toUpperCase() === "GET") {
						msg.channel.send("User permission for " + strResult + " is " + canUse);
					} else if(action.toUpperCase() === "TOGGLE") {
						if(Permissions.users.hasOwnProperty(userid)) {	
							Permissions.users[userid][cmd] = !canUse;
						}
						else {
							Permissions.users[userid].append({[cmd] : !canUse});
						}
						fs.writeFile("./permissions.json",JSON.stringify(Permissions,null,2));
						
						msg.channel.send("User permission for " + strResult + " set to " + Permissions.users[userid][cmd]);
					} else {
						msg.channel.send('Requires "get" or "toggle" parameter');
					}
				} else {
					msg.channel.send("Invalid command")
				}				
			}		
		}
	}
};

if(AuthDetails.hasOwnProperty("client_id")){
	commands["invite"] = {
		description: "generates an invite link you can use to invite the bot to your server",
		process: function(bot,msg,suffix){
			msg.channel.send("You wanna add me to your own server? Sure! Here's my link: https://discordapp.com/oauth2/authorize?&client_id=" + AuthDetails.client_id + "&scope=bot&permissions=470019135"); // send link to invite bot into server.
		}
	}
}


try{
	messagebox = require("./messagebox.json");
} catch(e) {
	//no stored messages
	messagebox = {};
}
function updateMessagebox(){
	require("fs").writeFile("./messagebox.json",JSON.stringify(messagebox,null,2), null);
}

var bot = new Discord.Client();

var hooks = {
	onMessage: []
}

bot.on("disconnected", function () {

	console.log("Disconnected!"); // send message that bot has disconnected.
	process.exit(1); //exit node.js with an error

});


//Log user status changes
bot.on("presence", function(user,status,gameId) {
	//if(status === "online"){
	//console.log("presence update");
	console.log(user+" went "+status);
	//}
	try{
	if(status != 'offline'){
		if(messagebox.hasOwnProperty(user.id)){
			console.log("found message for " + user.id);
			var message = messagebox[user.id];
			var channel = bot.channels.get("id",message.channel);
			delete messagebox[user.id];
			updateMessagebox();
			bot.send(channel,message.content);
		}
	}
	}catch(e){}
});


exports.addCommand = function(commandName, commandObject){
    try {
        commands[commandName] = commandObject;
    } catch(err){
        console.log(err);
    }
}
exports.commandCount = function(){
    return Object.keys(commands).length;
}
if(AuthDetails.bot_token){
	console.log("Logging in...");
	bot.login(AuthDetails.bot_token);
} else {
	console.log("Logging in with user credentials is no longer supported!\nYou can use token based log in with a user account, see\nhttps://discord.js.org/#/docs/main/master/general/updating");
}




//Requirements
const tokens = require('./tokens.json');
const actions = require('./actions');
const config = require("./config.json")['configuration']; // config file
const TimeParser = actions.Time;
const cv = require("./catvariables.js");


//Sends message in console telling you the bot is up
bot.on('ready', () => {
console.log('BOT STARTED UP!');
});

//Sets the bot's Playing/Streaming
bot.on('ready', () => {
bot.user.setActivity("Say .meow for help", {url: "https://www.twitch.tv"});
console.log(`${bot.user.tag} running on ${bot.guilds.size} guilds with ${bot.users.size} users.`);
});
  

  
bot.on("guildCreate", guild => {
console.log(`New guild added : ${guild.name}, owned by ${guild.owner.user.username}`);
});

bot.login(tokens.token);

bot.on('message', async message=> {

    const args = message.content.slice(tokens.prefix.length).trim().split(/ +/g);
const command = args.shift().toLowerCase();
const sayMessage = args.join(" ");

	if(message.author.bot) return; //Makes bot ignore itself and other bots
	
prefix = "."
	if(command === "activity"){
		bot.user.setActivity(sayMessage);}
	
	

	if(message.content.toLowerCase().startsWith(config['prefix'] + 'meow')){
		message.author.send({embed: {
            color: 14428821,
            author: {
                name: bot.user.username,
                icon_url: bot.user.displayAvatarURL,
            },
			title: '***A Bot by Sean, Hastur#9586, Updated Weekly***',
			thumbnail: {
				url: "https://pbs.twimg.com/media/DgdrzVzWAAQeV6e.png"
			  },
			fields: [
				{
					
					name: `${config['prefix']}meow`,
					value: 'Explodes a list of my main commands into existance. (You should have worn a typing condom)',
					inline: false
				},
				{
					name: `${config['prefix']}fun`,
					value: 'Magically creates a list of my entertaining commands specifically tailored to amuse.',
					inline: false
				},
				{
					name: `${config['prefix']}music`,
					value: "(not working ATM)Booms a list of commands to get it bumpin' up in yo voice channels into view.",
					inline: false
				},		
				{
					name: `${config['prefix']}nsfw`,
					value: "To be added in the future. This command does nothing at the moment",
					inline: false
				},		
				{
					name: `${config['prefix']}ping`,
					value: 'Displays latency.',
					inline: false
				},	
				{
					name: `${config['prefix']}tester`,
					value: 'Gives you my shakey quakey commands that are either temporary, in testing, or work in progress.' + "(Sometimes there's nothing there)",
					inline: false
				},	
				{
					name: "@Anti-Botty",
					value: 'WIP',
					inline: false
                }
            ]
        }}).catch(console.error);
		return;
	}

	if (message.content === mentionBot) {
		message.channel.send(":sleeping::astonished: Huh? Oh, don't worry I'm awake!")
				}
		
			if (message.content === mentionBot + ' fuck me') {
				message.channel.send('Hello, FBI? https://youtu.be/RdP1hJ908_o')
			}	
				
	if(message.content.toLowerCase().startsWith(config['prefix'] + 'fun')){
        message.channel.send({embed: {
            color: 14428821,
            author: {
                name: bot.user.username,
                icon_url: bot.user.displayAvatarURL,
            },
			title: '***A Bot by Sean, Hastur***',
			thumbnail: {
				url: "https://pbs.twimg.com/media/DgdrzVzWAAQeV6e.png"
			  },
			fields: [
				{
					name: `${config['prefix']}hug (@user)`,
					value: 'Sends a warm two arm body wrap to the special bud you mention.',
					inline: false
				},
				{
					name: `${config['prefix']}kiss (@user)`,
					value: 'Sends yummy smoochums to the V.I.P. you mention.',
					inline: false
				},
				{
					name: `${config['prefix']}pet`,
					value: 'YES! DO IT! USE THIS COMMAND NOW! Give me all the pets, pats, and rubs please.',
					inline: false
                },
            ]
        }}).catch(console.error);
		return;
	}
	if(message.content.toLowerCase().startsWith(config['prefix'] + 'music')){
        message.channel.send({embed: {
            color: 14428821,
            author: {
                name: bot.user.username,
                icon_url: bot.user.displayAvatarURL,
            },
			title: '***A Bot by Sean, Hastur***',
			thumbnail: {
				url: "https://pbs.twimg.com/media/DgdrzVzWAAQeV6e.png"
			  },
			fields: [
				{
					name: `Sorry, don't have these right now. :frowning2:`,
					value: 'N/A',
					inline: false
				},
				{
					name: `Sorry, don't have these right now. :frowning2:`,
					value: 'N/A',
					inline: false
				}
            ]
        }}).catch(console.error);
		return;
	}
	if(message.content.toLowerCase().startsWith(config['prefix'] + 'nsfw')){
        message.channel.send({embed: {
            color: 14428821,
            author: {
                name: bot.user.username,
                icon_url: bot.user.displayAvatarURL,
            },
			title: '__A Bot by Sean#9586__',
			thumbnail: {
				url: "https://pbs.twimg.com/media/DgdrzVzWAAQeV6e.png"
			  },
			fields: [
				{
					name: "Hey! I said I'm not ready yet! Check back when the message in .meow is changed" ,
					value: wip,
					inline: false
				}
            ]
        }}).catch(console.error);
		return;
	}
	if(message.content.toLowerCase().startsWith(config['prefix'] + 'tester')){
        message.channel.send({embed: {
            color: 14428821,
            author: {
                name: bot.user.username,
                icon_url: bot.user.displayAvatarURL,
            },
			title: '__A Bot by Sean#9586__',
			thumbnail: {
				url: "https://pbs.twimg.com/media/DgdrzVzWAAQeV6e.png"
			  },
			fields: [
				{
					name: "Nothing here at the moment" ,
					value: wip,
					inline: false
				}
            ]
        }}).catch(console.error);
		return;
	}


		// This event will run on every single message received, from any channel or DM.
		
		// It's good practice to ignore other bots. This also makes your bot ignore itself
		// and not get into a spam loop (we call that "botception").
		if(message.author.bot) return;
		
		// Also good practice to ignore any message that does not start with our prefix, 
		// which is set in the configuration file.
		if(message.content.indexOf(config.prefix) !== 0) return;
		
		// Here we separate our "command" name, and our "arguments" for the command. 
		// e.g. if we have the message "+say Is this the real life?" , we'll get the following:
		// command = say
		// args = ["Is", "this", "the", "real", "life?"]
	  
		if(command === "ping") {
			// Calculates ping between sending a message and editing it, giving a nice round-trip latency.
			// The second ping is an average latency between the bot and the websocket server (one-way, not round-trip)
			const m = await message.channel.send("Ping?");
			m.edit(`Pong! Latency is ${m.createdTimestamp - m.createdTimestamp}ms. API Latency is ${Math.round(bot.ping)}ms`);
		  }
		  
		 

	
    prefix = "!"
    
        
    if(message.author.bot) return; //Makes bot ignore itself and other bots
	
	
	
    if (command === "kiss") {
        let kissresult = Math.floor((Math.random() * kiss.length));
                                let selfkissresult = Math.floor((Math.random() * selfkiss.length));
        if (!args[0]) {
                const skissembed = new Discord.RichEmbed()
                        .setColor(`RANDOM`)
                        .setTitle(`${message.author.username} kissed themself...! 
                        (Practicing for a date?)`)
                        .setImage(selfkiss[selfkissresult])
                message.channel.send({
                        embed: skissembed
                })
                return;
        }
        if (!message.mentions.members.first().user.username === message.isMentioned(message.author)) {
                const kissembed = new Discord.RichEmbed()
                        .setColor(`RANDOM`)
                        .setTitle(`${message.author.username} gave ${message.mentions.members.first().user.username} a kiss! Aww!`)
                        .setImage(kiss[kissresult])
                message.channel.send({
                        embed: kissembed
                })
                return;
        }
    } 
    //Sends GIF with a message if user sends "!hug (another) @user" or "!hug (themself) @user"
    if (command === "hug") {
        let hugresult = Math.floor((Math.random() * hug.length));
        if (!args[0]) {
                const shugembed = new Discord.RichEmbed()
                        .setColor(`RANDOM`)
                        .setTitle(`${message.author.username} hugged themself...! 
                        (Don't worry I love you)`)
                        .setImage('https://media1.tenor.com/images/b2b011e1019b8a800b0dbbef44176f2a/tenor.gif?itemid=8385653')
                message.channel.send({
                        embed: shugembed
                })
                return;
        }
        if (!message.mentions.members.first().user.username === message.isMentioned(message.author)) {
                const hugembed = new Discord.RichEmbed()
                        .setColor(`RANDOM`)
                        .setTitle(`${message.author.username} gave ${message.mentions.members.first().user.username} a hug! That's so cute!`)
                        .setImage(hug[hugresult])
                message.channel.send({
                        embed: hugembed
                })
                return;
        }
        const shugembed = new Discord.RichEmbed()
                .setColor(`RANDOM`)
                .setTitle(`${message.author.username} hugged themself...! 
                (Don't worry I love you)`)
                .setImage('https://media1.tenor.com/images/b2b011e1019b8a800b0dbbef44176f2a/tenor.gif?itemid=8385653')
        message.channel.send({
                embed: shugembed
        })
    } 
    if (command === "pet") {
            petresult = Math.floor((Math.random() * pet.length));
            if (!args[0]) {
            const petembed = new Discord.RichEmbed()
            .setColor('RANDOM')
            .setTitle(`Purr... Thank You! Thank You! Thank You!`)
            .setImage(pet[petresult])
    message.channel.send({
            embed: petembed
    })
            return;
    }
    
    bot.login(tokens.token)}});

    