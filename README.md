# Rin

A modern serverless blog platform built on Cloudflare's ecosystem (Pages + Workers + D1 + R2).

## Demo

[fastcode.io](https://fastcode.io)

## Features

- GitHub OAuth login with first user gaining admin privileges
- Article writing and editing with real-time draft saving
- Private posts visible only to yourself
- Image upload support with S3-compatible storage
- Custom URL aliases (e.g., /about)
- Friend links with automatic health checking
- Comment system with webhook notifications
- Automatic header image detection
- Hashtag-style tag parsing
- SEO optimization
- RSS feed support

## Quick Start

1. Fork the repository

2. Set up Cloudflare Pages:
```
Build command: bun b
Build output: client/dist
```

3. Configure environment variables:
```
NAME=YourName
DESCRIPTION=Your Description
AVATAR=https://your-avatar-url
API_URL=https://your-worker-domain
PAGE_SIZE=5
```

4. Deploy the backend:
```bash
bun install
bun cf-deploy
```

## Documentation

- [Deployment Guide](./docs/DEPLOY.md)
- [Environment Variables](./docs/ENV.md)
- [SEO Configuration](./docs/SEO.md)
- [RSS Setup](./docs/RSS.md)

## Community

- [Discord](https://discord.gg/JWbSTHvAPN)
- [Telegram](https://t.me/openRin)

## License

MIT License - see [LICENSE](./LICENSE) for details.
