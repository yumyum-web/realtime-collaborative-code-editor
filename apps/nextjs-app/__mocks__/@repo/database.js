// Mock for @repo/database to avoid BSON/MongoDB import issues

// Mock connectDB
const connectDB = jest.fn().mockResolvedValue(undefined);

// Mock User model
const User = jest.fn().mockImplementation((data) => {
  if (!data.username) {
    throw new Error("ValidationError: username is required");
  }
  if (!data.email) {
    throw new Error("ValidationError: email is required");
  }
  if (!data.password) {
    throw new Error("ValidationError: password is required");
  }
  return {
    ...data,
    save: jest.fn().mockResolvedValue(data),
    validate: jest.fn().mockResolvedValue(true),
  };
});

User.findOne = jest.fn();
User.findById = jest.fn();
User.find = jest.fn();

// Mock Project model
const Project = jest.fn().mockImplementation((data) => {
  if (!data.title) {
    throw new Error("ValidationError: title is required");
  }
  if (!data.members) {
    throw new Error("ValidationError: members is required");
  }
  if (data.members.length === 0) {
    throw new Error("ValidationError: members cannot be empty");
  }
  // Check for invalid roles
  const validRoles = ["owner", "editor"];
  if (data.members.some((member) => !validRoles.includes(member.role))) {
    throw new Error("ValidationError: Invalid member role");
  }
  const defaults = {
    structure: {
      name: "root",
      type: "folder",
      children: [],
    },
    chats: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    ...defaults,
    ...data,
    save: jest.fn().mockResolvedValue({ ...defaults, ...data }),
    validate: jest.fn().mockResolvedValue(true),
  };
});

Project.findById = jest.fn();
Project.find = jest.fn();
Project.findOne = jest.fn();

// Mock Invitation model
const Invitation = jest.fn().mockImplementation((data) => {
  if (!data.projectId) {
    throw new Error("ValidationError: projectId is required");
  }
  if (!data.projectTitle) {
    throw new Error("ValidationError: projectTitle is required");
  }
  if (!data.ownerEmail) {
    throw new Error("ValidationError: ownerEmail is required");
  }
  if (!data.collaboratorEmail) {
    throw new Error("ValidationError: collaboratorEmail is required");
  }
  // Validate status enum
  const validStatuses = ["pending", "accepted", "declined"];
  if (data.status && !validStatuses.includes(data.status)) {
    throw new Error("ValidationError: Invalid status value");
  }
  const defaults = {
    status: "pending",
    createdAt: new Date(),
  };
  return {
    ...defaults,
    ...data,
    save: jest.fn().mockResolvedValue({ ...defaults, ...data }),
    validate: jest.fn().mockResolvedValue(true),
  };
});

Invitation.findOne = jest.fn();
Invitation.find = jest.fn();
Invitation.findById = jest.fn();

// Mock VersionControl model
const VersionControl = jest.fn().mockImplementation((data) => {
  if (!data.projectId) {
    throw new Error("ValidationError: projectId is required");
  }
  const defaults = {
    branches: [],
    activeBranch: "main",
  };
  return {
    ...defaults,
    ...data,
    save: jest.fn().mockResolvedValue({ ...defaults, ...data }),
    validate: jest.fn().mockResolvedValue(true),
  };
});

VersionControl.findOne = jest.fn();
VersionControl.find = jest.fn();
VersionControl.findById = jest.fn();

// Export all mocks
module.exports = {
  connectDB,
  User,
  Project,
  Invitation,
  VersionControl,
};
