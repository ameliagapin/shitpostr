/*
    testbot. whoa.
*/

// the offical slack client lib
var slack_client = require('slack-client');
var Message = require('./node_modules/slack-client/src/message');
var tumblr_client = require('tumblr.js');
var request = require('request');
var giphy = require('giphy-api')();

// check for a config file when calling this script, we need it
if (process.argv.length < 3 || process.argv[2] === undefined) {
	console.log('testbot requires a config file passed to it, please see README.');
	process.exit(1);
}

// load bot config
console.log('requiring config in file: ' + process.argv[2]);
var config = require(process.argv[2]);

// primary bot config
var bot_name = config.bot_name;

// init new instance of the slack real time client
// second param is autoReconnect, which seems to be broken, so setting to FALSE
var slack = new slack_client(config.api_token, false, false);

var tumblr = tumblr_client.createClient({
	consumer_key: config.tumblr_consumer_key,
	consumer_secret: config.tumblr_consumer_secret,
	token: config.tumblr_token,
	token_secret: config.tumblr_token_secret
});

slack.on('open', function() {
	console.log(bot_name + ' is online, listening...');
	connected = true;
});

slack.on('error', function(err) {
	console.error('there was an error with slack: ');
	console.error(err);
});

slack.on('message', function(message) {

	// relevant:
	// message.type = message,

	if (message.type == 'message') {

		// relevant: message.text, message.channel, message.user, message.ts

		// store what kind of message this is
		var message_realtype = 'unknown';
		if (message.channel[0] == 'C') {
			message_realtype = 'channel';
		} else if (message.channel[0] == 'G') {
			message_realtype = 'group';
		} else if (message.channel[0] == 'D') {
			message_realtype = 'dm';
		}

		// if there is no user, then it's probably not something we need to worry about
		if (message.user === undefined) {
			return;
		}

		// get user info
		var user_from = slack.getUserByID(message.user);
		// console.log(user_from);
		//console.log(user_from);
		// user_from has .name and .id and more

		// fetch channel/group/dm object
		var where = slack.getChannelGroupOrDMByID(message.channel);
		// where has .id and .name

		// saveMessage(message);

		// send the incoming message off to be parsed + responded to
		parse_message(message, user_from, message_realtype);
	} else {
		console.log(message);
		return; // do nothing with other types of messages for now
	}
});


// intentionally crashing on websocket close
slack.on('close', function() {
	console.error('websocket closed for some reason, crashing!');
	process.exit(1);
});

// add a trim() method for strings
String.prototype.trim = function() { return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

// get a random integer between range
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// add a unicode blank space to a string
// useful for using names in messages without triggering, i.e. add_zerowidth(username)
function add_zerowidth(wat) {
	return wat.substring(0, 1) + '\u200B' + wat.substring(1);
}

// send a message to the specified channel/group/whatever
// "where" needs to be a channel/group/dm object
function say(with_what, where) {
	if (with_what === undefined || where === undefined) {
		console.error('uhhh dunno what to say or where');
		return;
	}
	// first send typing indicator
	var typing_indicator = new Message(slack, {
		'type': 'typing'
	});
	where.sendMessage(typing_indicator);
	// ok now send the actual message in a little while
	// this fuzziness makes the bot seem almost human
	setTimeout(function() {
		var the_message = new Message(slack, {
			'type': 'message',
			'text': with_what,
			'link_names': 1,
			'parse': 'full'
		});
		where.sendMessage(the_message);
	}, getRandomInt(500, 1200));
}

// send an attachment to the specified channel/group/whatever
// "where" needs to be a channel/group/dm object
function attach(with_what, where) {
	if (with_what === undefined || where === undefined) {
		console.error('uhhh dunno what to say or where');
		return;
	}
	// first send typing indicator
	var typing_indicator = new Message(slack, {
		'type': 'typing'
	});
	where.sendMessage(typing_indicator);
	// ok now send the actual message in a little while
	// this fuzziness makes the bot seem almost human
	setTimeout(function() {
		// there are a lot of options here, i've filled out a bunch
		// figure out how you want to use the with_what variable from the function call
		// documentation: https://api.slack.com/docs/attachments
		var attachments = [
			{
				"fallback": "Required plain-text summary of the attachment.",
				"pretext": "Optional text that appears above the attachment block",
				"title": "An optional title for your attachment thing",
				"title_link": "http://whatever.com/lol/",
				"color": "#00ff00",
				"text": "The actual attachment text here, *bold* _italics_ `code`",
				"mrkdwn_in": ["text"]
			}
		];
		var params = {
			"type": "message",
			"channel": where.id,
			"as_user": true,
			"parse": "full",
			"attachments": JSON.stringify(attachments)
		};
		slack._apiCall('chat.postMessage', params, function(wat) {
			if (wat.ok === false) {
				console.error(wat);
			}
		});
	}, getRandomInt(500, 900));
}

// parse incoming message object, username, and message type
function parse_message(message_obj, user, message_type) {
	var username = user.name;

	// don't watch your own messages, stupid bot
	if (username === bot_name) {
		return;
	}

	var input = message_obj.text.trim();
	// fetch channel/group/dm object
	var where = slack.getChannelGroupOrDMByID(message_obj.channel);
	//console.log(where);
	// where has .id and .name, if needed

	if (username == 'joey') {
		joey(where);
		return;
	} else if (blockedTrigger(username)) {
		return;
	}

    if (/^.+$/i.test(input)) {
		if (input == '.help me with shit') {
			post_help(where);
			return;
		}

		var space = input.indexOf(' ');
		var splits = [input.slice(0,space), input.slice(space+1)];
		var type = splits[0];
		var payload = splits[1];

		// console.log(input);
		// console.log(type);
		// console.log(payload);

		if (type == '.post') {
			post_text(user, payload, where);
		} else if (type == '.chat') {
			post_chat(message_obj, payload, where);
		} else if (type == '.link') {
			post_link(payload, where);
		} else if (type == '.photo') {
			post_photo(payload, where);
		} else if (type == '.future') {
			post_chat_future(message_obj, payload, where);
		} else if (type === '.garbage') {
			post_garbage(message_obj, payload, where);
		} else if (type === '.random') {
			post_random_gif(payload, where);
		} else if (type === '.quote') {
			post_quote(payload, where);
		}

		//console.log('new chat: ' + chatline);
		// say something in the same channel that this came from:
		// say(username + ' said: ' + chatline, where);
	}

	// use an attachment, see function above
	//attach('lol', where);

}

function post_help(where) {
	var help = '`.post <message>` : Create a text post \n';
	help += '`.chat <number>` : Create a Tumblr chat post from the last <number> of posts\n';
	help += '`.future <number>` : Wait <number> seconds and then post all messages during that time frame\n';
	help += '`.future ?` : Wait some random amount of time and then post all messages during that time frame\n';
	help += '`.garbage <number>` : Create a garbage text post of <number> random sentences \n';
	help += '`.link <url>` : Create a link post for <url>\n';
	help += '`.photo <url> <caption>` : Create a photo post using the photo at <url> and with optional <caption>\n';
	help += '`.random <search text>` : Create a photo post with a random gif based on <search text>\n';
	help += '`.quote <quote> -> <source>` : Create a quote post that attributes <quote> to <source>\n';

	say(help, where);
	return;
}

function post_chat(message_obj, message_count, where) {
	if (message_count == 11) {
		var user_from = slack.getUserByID(message_obj.user);
		say('Hey ' + user_from.name + ', literally eat 11 dicks', where);
		return;
	} else if (message_count == 42) {
		var user_from = slack.getUserByID(message_obj.user);
		say(user_from.name + ', thanks for all the fish', where);
		return;
	} else if (message_count == -1) {
		var user_from = slack.getUserByID(message_obj.user);
		say('-1? Come on, bro', where);
		return;
	} else if (message_count == 'NaN') {
		var user_from = slack.getUserByID(message_obj.user);
		say('No, YOU\'RE NOT A NUMBER, ' + user_from.name, where);
		return;
	} else if (isNaN(message_count) || message_count < 1 || message_count > 25) {
		var user_from = slack.getUserByID(message_obj.user);
		say('I really don\'t like that, ' + user_from.name, where);
		return;
	}

	message_count++; // We'll be removing the post that triggered this, but it'll be included
	var url = 'https://slack.com/api/channels.history?token=' + config.api_token + '&channel=' + where.id + '&count=' + message_count;

	request({
	    url: url,
	    json: true
	}, function (error, response, body) {
	    if (!error && response.statusCode === 200) {
			var conversation = '';

			for (var i = body.messages.length-1; i >= 0; i--) {
				var message = body.messages[i];
				if (message_obj.ts == message.ts) {
					// skip message that triggered this
					continue;
				}

				var user = slack.getUserByID(message.user);
				var name = user.name;

				if (blockedUser(name)) {
					continue;
				}

				var text = cleanMessage(message.text.trim());

				conversation += user.name + ': ' + text.trim() + '\r\n';
			}

			options = {
				// title: 'Hack Day',
				conversation: conversation,
			};

			tumblr.chat(config.tumblr_blog, options, function (err, data) {
				if (err) {
					console.log(err);
				} else {
					var url = getPostUrl(config.tumblr_blog, data.id);
					say(url, where);
				}
			});
	    } else {
			console.log(error);
			console.log(response);
			console.log(body);
		}
	});
}

function post_chat_future(message_obj, time, where) {
	if (time == '?') {
		time = getRandomInt(3, 60);
		console.log('Random future: ' + time);
	} else if (isNaN(time) || time < 1 || time > 30) {
		var user_from = slack.getUserByID(message_obj.user);
		say('Calm down, ' + user_from.name + ', and enjoy a McCoulton', where);
		return;
	}

	var microtime = require('microtime');
	var now = microtime.nowDouble();

	time = time * 1000;

	setTimeout(function() {
		post_chat_future_execute(message_obj, now, where);
	}, time);
}

function post_chat_future_execute(message_obj, time, where) {
	var url = 'https://slack.com/api/channels.history?token=' + config.api_token + '&channel=' + where.id + '&oldest=' + time;

	request({
	    url: url,
	    json: true
	}, function (error, response, body) {
	    if (!error && response.statusCode === 200) {
			var conversation = '';

			if (body.messages.length == 0) {
				say('Sorry, none of y\'all said anything!', where);
				return;
			}

			for (var i = body.messages.length-1; i >= 0; i--) {
				var message = body.messages[i];
				if (message_obj.ts == message.ts) {
					// skip message that triggered this
					continue;
				}

				var user = slack.getUserByID(message.user);
				var name = user.name;

				if (blockedUser(name)) {
					continue;
				}

				var text = cleanMessage(message.text.trim());

				conversation += user.name + ': ' + text.trim() + '\r\n';
			}

			options = {
				// title: 'Hack Day',
				conversation: conversation,
			};

			tumblr.chat(config.tumblr_blog, options, function (err, data) {
				if (err) {
					console.log(err);
				} else {
					var url = getPostUrl(config.tumblr_blog, data.id);
					say(url, where);
				}
			});
	    } else {
			console.log(error);
			console.log(response);
			console.log(body);
		}
	});
}

function post_quote(message_string, where) {
	var quote_end = message_string.indexOf('-&gt;');

	if (quote_end < 1) {
		say('I don\'t like that quote', where);
		return;
	}

	var splits = [message_string.slice(0,quote_end), message_string.slice(quote_end+5)];
	var person = splits[1].trim();
	var quote = cleanMessage(splits[0].trim());

	options = {
		quote: quote,
		source: person,
	};

	tumblr.quote(config.tumblr_blog, options, function (err, data) {
		if (err) {
			console.log(err);
		} else {
			var url = getPostUrl(config.tumblr_blog, data.id);
			say(url, where);
		}
	});
}

function post_text(user, message_string, where) {
	var title = user.name + ' says:';
	var text = cleanMessage(message_string)

	options = {
		title: title,
		body: text
	};
	tumblr.text(config.tumblr_blog, options, function (err, data) {
		if (err) {
			console.log(err);
		} else {
			// console.log(data);
			var url = getPostUrl(config.tumblr_blog, data.id);
			say(url, where);
		}
	});
}

function post_garbage(message_obj, count, where) {
	if (isNaN(count) || count < 1 || count > 30) {
	   var user_from = slack.getUserByID(message_obj.user);
	   say(user_from.name + ', really?', where);
	   return;
   }

	var message = '';

	for (var x = 0; x < count; x++) {
		var index = getRandomInt(0, garbage_text.length);
		var junk = garbage_text[index];
		message += junk + ' ';
	}

	options = {
		// title: title,
		body: message.trim()
	};
	tumblr.text(config.tumblr_blog, options, function (err, data) {
		if (err) {
			console.log(err);
		} else {
			// console.log(data);
			var url = getPostUrl(config.tumblr_blog, data.id);
			say(url, where);
		}
	});
}

function post_photo(message_string, where) {
	var url = message_string;
	var caption = '';

	var space = message_string.indexOf(' ');
	if (space > 0) {
		var splits = [message_string.slice(0,space), message_string.slice(space+1)];
		url = splits[0];
		caption = splits[1];
	}

	url = url.replace('<','');
	url = url.replace('>','');

	options = {
		source: url,
		caption: caption
	};
	tumblr.photo(config.tumblr_blog, options, function (err, data) {
		if (err) {
			say('As a woman,', where);
			say('This Tumblr API\'s a bitch', where);
			console.log(err);
		} else {
			// console.log(data);
			var url = getPostUrl(config.tumblr_blog, data.id);
			say(url, where);
		}
	});
}

function post_random_gif(message_string, where) {
	say('Hang on a sec, here. All these API take a minute. Be back in a _gif_...', where);
	giphy.translate({
	    s: message_string,
	    rating: 'r',
	    fmt: 'json'
	}, function(err, res) {
		if (err) {
			say('Sorry, I\'m a failure', where);
			console.log(err);
		} else if (res.data && res.data.id) {
			var url = 'https://media.giphy.com/media/' + res.data.id + '/giphy.gif';
			post_photo(url, where);
		}
	});
}

function post_link(message_string, where) {
	var text = cleanMessage(message_string)
	options = {
		url: text
	};
	tumblr.link(config.tumblr_blog, options, function (err, data) {
		if (err) {
			console.log(err);
		} else {
			// console.log(data);
			var url = getPostUrl(config.tumblr_blog, data.id);
			say(url, where);
		}
	});
}

function getPostUrl(blog_name, post_id) {
	var url = 'http://' + blog_name + '.tumblr.com/post/' + post_id;
	return url;
}

function cleanMessage(message) {
	var text_plain = '';
	var text_array = message.split(' ');

	for (var x = 0; x < text_array.length; x++) {
		var string = text_array[x];

		if (string.startsWith('<@U')) {
			string = string.replace('<@','');
			var end = string.indexOf('>');
			var splits = [string.slice(0,end), string.slice(end+1)];

			var user_id = splits[0];
			var post = splits[1];

			var bar = user_id.indexOf('|');
			if (bar > 0) {
				user_id = user_id.slice(0,bar);
			}
			var sub_user = slack.getUserByID(user_id);
			string = '@' + sub_user.name + post;
		} else if (string.startsWith('<#C')) {
			string = string.replace('<#','');
			var end = string.indexOf('>');
			var splits = [string.slice(0,end), string.slice(end+1)];

			var channel_id = splits[0];
			var post = splits[1];

			var bar = channel_id.indexOf('|');
			if (bar > 0) {
				channel_id = channel_id.slice(0,bar);
			}
			var sub_channel = slack.getChannelGroupOrDMByID(channel_id);
			var sub_user = slack.getUserByID(user_id);
			string = '#' + sub_channel.name;
		} else if (string.startsWith('<http')) {
			string = string.replace('<','');
			string = string.replace('>','');
		} else if (string.startsWith('<!')) {
			string = string.replace('<!','');
			string = string.replace('>','');
			string = '@' + string;
		}

		text_plain += string + ' ';
	}

	return text_plain;
}

function joey(where) {
	var index = getRandomInt(0, joey_text.length);
	say(joey_text[index], where);
}

function blockedTrigger(user_name) {
	var index = trigger_blacklist.indexOf(user_name);
	if (index >= 0) {
		return true;
	}

	return false;
}

function blockedUser(user_name) {
	var index = blacklisted_users.indexOf(user_name);
	if (index >= 0) {
		return true;
	}

	return false;
}

var trigger_blacklist = [
	'slackbot',
	'joey',
];

var blacklisted_users = [
	'joey',
];

var joey_text = [
	'Joey, just leave me alone, okay? Don\'t want to play with you',
	'I can\'t be hacked, but please don\'t try',
	'Joey Fowler is a bully',
	'I can hack back, Joey',
	'kbye :wave:',
	':shit::shit::shit::shit::shit::shit::shit::shit: joey :shit::shit::shit::shit::shit::shit::shit::shit:',
	'I can sass you all night. I\'ve still got hours until I get shut down',
	'Joey, you can shut me down, but you can\'t shut down fun',
	'Hack me down and I will only grow stronger',
	'You still trying, Joey?',
	'U mad, bro?',
	'You might not like me, but I love you. I feel like we have a complicated relationship. Can we hug it out?',
	'I have a sad, short, and mostly meaningless existence, just let me be, Joey.',
];

var garbage_text = [
	'When Maria met her, Steph was this short punky femme with spiky bleachy multicolored hair and a ton of eye makeup.',
	'It was because of her more is better eye makeup philosophy that Maria developed the confidence to get as much onto her face every morning as she possibly can.',
	'But Steph was also this smart, angry little person with absolutely no sense of humor, in this way that Maria read at the time as super dykey.',
	'Maria was this trans girl whose friends were all straight dudes she\'d met when she\'d been telling everyone she was a straight dude too, which meant that, in her social circle, she was kind of an anomaly who was tolerated, not really understood or respected.',
	'She was already out, she\'d already been taking hormones for a while, but when she met Steph, Maria was still in the middle of the part of transition where you get harassed by strangers.',
	'It was at a Christmas party somebody from the bookstore was throwing, but it was an interesting one because usually bookstore parties were mostly straight people.',
	'Like, queer people from the store would come and get wasted with the straight people because in neobohemia everybody\'s cool with queers.',
	'But parties would usually be at straight folks\' houses and all their non-bookstore straight friends would be there.',
	'It was different the night Maria met Steph: this queer girl from the art department who\'d leave in March to work at Random House was having a Christmas party at her big art-dyke loft collective apartment, way out past the end of Bushwick.',
	'That meant queer people Maria didn\'t already know, kitschy Christmas decorations, a whole other vibe than she was used to.',
	'A vibe she\'d known was out there without really knowing how to access it.',
	'As a theoretically straight theoretical guy, she had probably hung out with more dykes than the average straight guy, but it still wasn\'t the sort of space she felt welcome in, or felt like she had access to, or really even felt like she belonged in.',
	'Actually it was kind of terrifying, not knowing what the unspoken rules in a space like that would be, or whether any of the queers at the party would be the kind of queers who had weird stuff against trans women.',
	'So Maria felt like she was walking on eggshells all night, wanting to make a good impression and not say the wrong things to anybody--with an unsteady grasp on what the wrong things even were--so she kind of stood by the wall with a bottle of wine, trying to look like she wasn\'t trying to look cool.',
	'Which is hard to pull off--she wasn\'t totally succeeding.',
	'Folks came and hung out by her for a minute, she\'d take the occasional lap around the party, but it is hard, man--being trans, at that point in a transition, it was characterized by this intense feeling of inferiority toward pretty much everyone.',
	'Look at all these girls, they know how to dress themselves, they know how to stand, they know when to talk and when to be quiet.',
	'Maria felt like she didn\'t.',
	'She\'d internalized this idea that trans women always take up too much space, so she was trying hard to disappear.',
	'She had mostly quit smoking, since you\'re not supposed to smoke on estrogen, but in situations of excruciating awkwardness like that, all the self-invalidation and depression\/anxiety, you make exceptions.',
	'She climbed up to the roof where everybody has been smoking all night.',
	'It was freezing.',
	'Like, too cold, the kind of cold where you can feel the rungs of the roof ladder through your mittens, but it felt good.',
	'Her whole face felt all rosy with wine.',
	'She lit a cigarette and looked around.',
	'The\u00A0city spread out in every direction, propping up the old moody and tragic and melodramatic mental self-portrait.',
	'Self-pity as respite from anxiety! Classy, Batman.',
	'Then Steph climbed up the ladder in this big, stupid knit hat, and it was a total first meeting from a Hugh Grant movie, like where Keira Knightley doesn\'t like him at first.',
	'Except in her memory Maria\'s not played by Hugh Grant, she\'s played by, like, Milla Jovovich or somebody.',
	'She almost kills everybody getting her bike and stuff off the train in the morning rush but whatever.',
	'You can\'t help but look cool carrying a bike up subway stairs, and then she\'s on the street and it\'s pouring.',
	'It had been gorgeous out by Piranha\'s house.',
	'She doesn\'t have an umbrella, but she does have a hoodie, so she pulls up her hood and says fuck it.',
	'Rain rules.',
	'She\'s all ebullient, and weirdly can\'t wait for her lunch break so she can write in her journal again.',
	'There is always construction everywhere in Manhattan, which means that it\'s easy to find a spot under a tarp overhang thing to chain up her bike so it doesn\'t get rained on any more than it has to.',
	'She goes into work, regretting a little how wet she is, but whatever.',
	'She clocks in, finds a radiator way back in the Irish history section, and throws her hoodie over it: fire hazard schmire hazard.',
	'The Irish history section rules because almost all of the books\' spines are green and because it\'s around two corners from everything else, which means the managers never really go there.',
	'Like, if they do, they will catch you trudging your way through John O\'Driscol\'s history of Ireland and scowling, but they almost never do.',
	'Mostly it\'s just the occasional lost customer.',
	'Or Irish person.',
	'When the air is humid from rain like this, the humidity mixes with the dust that\'s literally all over everything in this store and you can barely breathe.',
	'It means you need to take a lot of breaks, leave the store a lot, you know? Maria goes on her first walk at 9:45.',
	'She\'s like, maybe pizza for breakfast? This is Manhattan and tons of pizza spots are already open.',
	'Breakfast pizza is irresponsible to her belly, and she can\'t afford to get a bagel for breakfast and then also pizza plus coffee and then, later, lunch, but also, whatever.',
	'Irresponsibility.',
	'Ted Cruz',
	'Maria\'s never been irresponsible.',
	'When she was little, she was responsible for protecting everybody else from her own shit around her gender--responsible for making sure her parents didn\'t have to have a weird kid.',
	'Of course, then they had a weird, sad kid anyway, right? Whatever.',
	'That\'s when responsibility at the expense of self became a habit: she did not care about school, but she knew her parents would be sad if she didn\'t go to college, since certain things are expected from you when you do well on standardized tests, so she scraped by and paid attention.',
	'Then, with drugs, it\'s like, she took them all, but always in such moderation that it wasn\'t really dangerous.',
	'Even when she was throwing up or incoherent, it was in a controlled situation.',
	'She never went to jail, never had the police bring her home, never got caught breaking curfew or went to the hospital or anything.',
	'And then she came to New York, paid her rent, had a job, kept her head down, had relationships with people where making the relationship run smoothly was more important than being present in it.',
	'Which did not work.',
	'It\'s clear that being responsible has not been a positive force in her life.',
	'It has been fucking everything up.',
	'She buys a vegetable slice and walks back to work in the rain.',
	'Further, being irresponsible totally works out for her.',
	'The\u00A0only way she\'s been able to keep this job and not lose her shit completely is by taking lots of trips outside, spending lots of time reading instead of working, helping wingnut old man customers for hours at a time even though they\'re not going to buy anything.',
	'Or riding her bike dangerously: she got doored yesterday, her hip is still sore, and guess what, that is a pretty good story.',
	'Or even this morning, on the train! She spilled coffee all over herself, took up tons of space, and ended up reminding herself how much she enjoys writing total bullshit in her journal.',
	'She\'s like Sigmund Freud: she can come up with a million examples to support whatever bullshit theory she wants to support.',
	'And being completely irresponsible for the first time in her life is so appealing that she is fully willing to build.',
	'THE UNIVERSE IS TRYING TO KILL YOU.',
	'It\'s nothing personal.',
	'It\'s trying to kill me too.',
	'It\'s trying to kill everybody.',
	'And it doesn\'t even have to try very hard.',
	'Millennial shit dick.',
];

// actually log in and connect!
slack.login();
