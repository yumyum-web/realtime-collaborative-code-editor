This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## ✨ Features

- 🔄 **Real-time Collaboration**: Edit code simultaneously with multiple users
- 📝 **Monaco Editor**: Full-featured code editor with syntax highlighting
- 🌳 **File Tree Management**: Create, edit, and organize project files
- 💬 **Team Chat**: Integrated messaging for better collaboration
- 🤖 **AI Assistant**: AI-powered code suggestions and chat
- 🔀 **Local Git Version Control**: Branch management, commits, and merges
- 🐙 **GitHub Integration**: Connect to GitHub, create repos, view commits (NEW!)
- 👥 **Project Collaboration**: Invite team members and manage access

## 🚀 GitHub Integration

CollabCode now supports full GitHub integration! Connect your GitHub account to:

- Create new repositories directly from the editor
- View commit history from your GitHub repos
- Sync your collaborative work with GitHub (push/pull coming soon)

See [GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md) for setup instructions.

## Getting Started

First, install dependencies:

```bash
npm install
```

To run the development servers (Next.js, Socket.IO, and Yjs WebSocket servers):

```bash
npm run dev:all
```

This will start all three servers concurrently:

- Next.js development server on http://localhost:3000
- Socket.IO server on http://localhost:3001 (or port defined in SOCKET_PORT env var)
- Yjs WebSocket server on ws://localhost:1234 (or port defined in YJS_PORT env var)

For production, first build the Next.js app:

```bash
npm run build
npm run start:all
```

Alternatively, you can run individual servers:

- `npm run dev` - Next.js only
- `npm start` - Next.js production only
- `tsx server/socketServer.ts` - Websocket server only
- `y-websocket-server` - Yjs WebSocket server only

Then,

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
