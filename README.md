# shitpostr
Janky Hack Day project to make Tumblr shit posts from Slack

# setup
1. Fill out Tumblr and Slack API keys in `config.js`.
2. Use `blacklisted_users` to ignore all messages from a certain username.
3. Use `trigger_blacklist` to stop Shitpostr from trigger on messages from certain users.

# commands
* `.post <message>`: Will create a text post
* `.chat <number>`: Will create a Tumblr chat post from the last <number> of posts
* `.future <number>`: Will wait <number> seconds and then post all messages during that time frame
* `.garbage <number>`: Creates a text post of <number> random sentences
* `.link <url>`: Creates link post for <ur>
* `.photo <url> <caption>`: Creates a photo post using the photo at <url> and with optional <caption>
