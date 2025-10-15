# @repo/database

Shared database package containing MongoDB connection utilities and Mongoose models for the realtime collaborative code editor.

## Contents

- **connectDB**: MongoDB connection utility
- **Models**: User, Project, Invitation, VersionControl
- **Types**: TypeScript interfaces and types for all models

## Usage

```typescript
import {
  connectDB,
  User,
  Project,
  Invitation,
  VersionControl,
} from "@repo/database";
import type { ProjectDocument, FileEntity } from "@repo/database";

// Connect to database
await connectDB();

// Use models
const user = await User.findOne({ email: "user@example.com" });
const project = await Project.findById(projectId);
```

## Development

```bash
# Build the package
npm run build

# Watch mode for development
npm run dev

# Type check
npm run typecheck
```
