import VersionControl from "../models/VersionControl";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock mongoose to avoid actual DB connections
jest.mock("mongoose");

describe("VersionControl Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Schema Validation", () => {
    it("should create a version control with valid data", () => {
      const vcData = {
        projectId: "507f1f77bcf86cd799439011",
        branches: [
          {
            name: "main",
            commits: [],
            lastStructure: { name: "root", type: "folder", children: [] },
          },
        ],
        activeBranch: "main",
      };

      const vc = new VersionControl(vcData);
      expect(vc.projectId.toString()).toBe(vcData.projectId);
      expect(vc.branches).toEqual(vcData.branches);
      expect(vc.activeBranch).toBe(vcData.activeBranch);
    });

    it("should require projectId", () => {
      const vcData = {
        branches: [],
        activeBranch: "main",
      };

      expect(() => new VersionControl(vcData)).toThrow();
    });

    it("should have default branches as empty array", () => {
      const vcData = {
        projectId: "507f1f77bcf86cd799439011",
      };

      const vc = new VersionControl(vcData);
      expect(vc.branches).toEqual([]);
    });

    it("should have default activeBranch as main", () => {
      const vcData = {
        projectId: "507f1f77bcf86cd799439011",
      };

      const vc = new VersionControl(vcData);
      expect(vc.activeBranch).toBe("main");
    });

    it("should validate branch structure", () => {
      const vcData = {
        projectId: "507f1f77bcf86cd799439011",
        branches: [
          {
            name: "main",
            commits: [
              {
                message: "Initial commit",
                author: "user@example.com",
                timestamp: new Date(),
                structure: { name: "root", type: "folder", children: [] },
              },
            ],
            lastStructure: { name: "root", type: "folder", children: [] },
          },
        ],
      };

      const vc = new VersionControl(vcData);
      expect(vc.branches[0].commits.length).toBe(1);
      expect(vc.branches[0].commits[0].message).toBe("Initial commit");
    });
  });
});
