import Project from "../models/project";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock mongoose to avoid actual DB connections
jest.mock("mongoose");

describe("Project Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Schema Validation", () => {
    it("should create a project with valid data", () => {
      const projectData = {
        title: "Test Project",
        description: "A test project",
        members: [
          {
            email: "owner@example.com",
            username: "owner",
            role: "owner" as const,
          },
        ],
        structure: { name: "root", type: "folder", children: [] },
        gitRepoPath: "/path/to/repo",
        chats: [],
      };

      const project = new Project(projectData);
      expect(project.title).toBe(projectData.title);
      expect(project.description).toBe(projectData.description);
      expect(project.members).toEqual(projectData.members);
      expect(project.structure).toEqual(projectData.structure);
      expect(project.gitRepoPath).toBe(projectData.gitRepoPath);
      expect(project.chats).toEqual(projectData.chats);
    });

    it("should require title", () => {
      const projectData = {
        members: [
          {
            email: "owner@example.com",
            username: "owner",
            role: "owner" as const,
          },
        ],
      };

      expect(() => new Project(projectData)).toThrow();
    });

    it("should require members", () => {
      const projectData = {
        title: "Test Project",
      };

      expect(() => new Project(projectData)).toThrow();
    });

    it("should validate member roles", () => {
      const projectData = {
        title: "Test Project",
        members: [
          {
            email: "owner@example.com",
            username: "owner",
            role: "invalid" as string, // Invalid role
          },
        ],
      };

      expect(() => new Project(projectData)).toThrow();
    });

    it("should have default structure", () => {
      const projectData = {
        title: "Test Project",
        members: [
          {
            email: "owner@example.com",
            username: "owner",
            role: "owner" as const,
          },
        ],
      };

      const project = new Project(projectData);
      expect(project.structure).toEqual({
        name: "root",
        type: "folder",
        children: [],
      });
    });

    it("should have default chats as empty array", () => {
      const projectData = {
        title: "Test Project",
        members: [
          {
            email: "owner@example.com",
            username: "owner",
            role: "owner" as const,
          },
        ],
      };

      const project = new Project(projectData);
      expect(project.chats).toEqual([]);
    });

    it("should validate chat messages", () => {
      const projectData = {
        title: "Test Project",
        members: [
          {
            email: "owner@example.com",
            username: "owner",
            role: "owner" as const,
          },
        ],
        chats: [
          {
            senderEmail: "user@example.com",
            senderUsername: "user",
            message: "Hello",
            timestamp: new Date(),
          },
        ],
      };

      const project = new Project(projectData);
      expect(project.chats.length).toBe(1);
      expect(project.chats[0].message).toBe("Hello");
    });
  });
});
