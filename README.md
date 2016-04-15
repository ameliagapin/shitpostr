# shitpostr
Janky Hack Day project to make Tumblr shit posts from Slack

# setup
1. Fill out Tumblr and Slack API keys in `config.js`.
2. Use `blacklisted_users` to ignore all messages from a certain username.
3. Use `trigger_blacklist` to stop Shitpostr from trigger on messages from certain users.

# commands
* `.post <message>` : Create a text post
* `.chat <number>` : Create a Tumblr chat post from the last <number> of posts
* `.future <number>` : Wait <number> seconds and then post all messages during that time frame
* `.garbage <number>` : Create a garbage text post of <number> random sentences
* `.link <url>` : Create a link post for <ur>
* `.photo <url> <caption>` : Create a photo post using the photo at <url> and with optional <caption>
* `.random <search text>` : Create a photo post with a random gif based on <search text>
* `.quote <quote> -> <source>` : Create a quote post that attributes <quote> to <source>
