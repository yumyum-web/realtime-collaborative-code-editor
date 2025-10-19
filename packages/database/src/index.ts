// Export database connection
export { default as connectDB } from "./connectDB.js";

// Export models
export { default as User } from "./models/User.js";
export { default as Project } from "./models/project.js";
export { default as Invitation } from "./models/Invitation.js";
export { default as VersionControl } from "./models/VersionControl.js";

// Export types from models
export type {
  Member,
  ChatMessage,
  AiChatMessage,
  FileEntity,
  ProjectDocument,
} from "./models/project.js";

export type {
  Commit,
  Branch,
  VersionControlDocument,
} from "./models/VersionControl.js";
