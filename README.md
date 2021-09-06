# Discord-REST-Queue

A queue that takes incoming Discord API requests (that are messages sent to servers), and then magically handles all rate limiting information that Discord returns.

This is specially designed for https://github.com/synzen/MonitoRSS.

A config file should be made in the root directory.

```json
{
  "token": "",
  "redis": "",
  "httpPort": 8081,
  "databaseURI": "mongodb://localhost/rss",
  "redisPrefix": "mrss_",
  "concurrencyLimit": 5000,
  "maxRequestsPerSecond": 25
}
```

This producer should send JSON buffers in the format of:

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
