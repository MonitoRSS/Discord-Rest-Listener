# Discord-REST-Queue

A queue that takes incoming Discord API requests (that are messages sent to servers), and then magically handles all rate limiting information that Discord returns. The bot used with this queue is guaranteed to **never** get banned (but the length of the queue may get too long under extremely heavy loads).

This is specially designed for https://github.com/synzen/MonitoRSS. For more information on this service, see [the blog post](https://medium.com/@mtan9558/scaling-message-delivery-of-a-discord-rss-bot-a6b0c460a923).

A config file should be made in the root directory.

```json
{
  "token": "",
  "redis": "",
  "httpPort": 8081,
  "databaseURI": "mongodb://localhost/rss",
  "redisPrefix": "mrss_"
}
```

A producer should connect to the binding address above using [zeromq](https://zeromq.org/). This producer should send JSON buffers in the format of:

```js
{
  token: "token",
  article: {
    _id: "article ID"
  },
  feed: {
    _id: "feed id",
    url: "feed url",
    channel: "channel ID"
  },
  api: {
    url: "discord's API URL",
    method: "HTTP method, usually POST",
    body: "body content to send to Discord's API"
  }
}
```
