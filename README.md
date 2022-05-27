# Discord-REST-Queue

A queue that takes incoming Discord API requests (that are messages sent to servers), and then magically handles all rate limiting information that Discord returns.

This is specially designed for https://github.com/synzen/MonitoRSS.

A `.env` file should be made

```
TOKEN=
DATABASE_URI=
MAX_REQUESTS_PER_SECOND=
RABBITMQ_URI=
DISCORD_CLIENT_ID
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
