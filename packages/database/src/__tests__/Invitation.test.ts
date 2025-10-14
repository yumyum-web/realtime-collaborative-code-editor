import Invitation from "../models/Invitation";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock mongoose to avoid actual DB connections
jest.mock("mongoose");

describe("Invitation Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Schema Validation", () => {
    it("should create an invitation with valid data", () => {
      const invitationData = {
        projectId: "507f1f77bcf86cd799439011", // Mock ObjectId
        projectTitle: "Test Project",
        ownerEmail: "owner@example.com",
        collaboratorEmail: "collaborator@example.com",
        status: "pending",
      };

      const invitation = new Invitation(invitationData);
      expect(invitation.projectId.toString()).toBe(invitationData.projectId);
      expect(invitation.projectTitle).toBe(invitationData.projectTitle);
      expect(invitation.ownerEmail).toBe(invitationData.ownerEmail);
      expect(invitation.collaboratorEmail).toBe(
        invitationData.collaboratorEmail,
      );
      expect(invitation.status).toBe(invitationData.status);
    });

    it("should require projectId", () => {
      const invitationData = {
        projectTitle: "Test Project",
        ownerEmail: "owner@example.com",
        collaboratorEmail: "collaborator@example.com",
      };

      expect(() => new Invitation(invitationData)).toThrow();
    });

    it("should require projectTitle", () => {
      const invitationData = {
        projectId: "507f1f77bcf86cd799439011",
        ownerEmail: "owner@example.com",
        collaboratorEmail: "collaborator@example.com",
      };

      expect(() => new Invitation(invitationData)).toThrow();
    });

    it("should require ownerEmail", () => {
      const invitationData = {
        projectId: "507f1f77bcf86cd799439011",
        projectTitle: "Test Project",
        collaboratorEmail: "collaborator@example.com",
      };

      expect(() => new Invitation(invitationData)).toThrow();
    });

    it("should require collaboratorEmail", () => {
      const invitationData = {
        projectId: "507f1f77bcf86cd799439011",
        projectTitle: "Test Project",
        ownerEmail: "owner@example.com",
      };

      expect(() => new Invitation(invitationData)).toThrow();
    });

    it("should have default status as pending", () => {
      const invitationData = {
        projectId: "507f1f77bcf86cd799439011",
        projectTitle: "Test Project",
        ownerEmail: "owner@example.com",
        collaboratorEmail: "collaborator@example.com",
      };

      const invitation = new Invitation(invitationData);
      expect(invitation.status).toBe("pending");
    });

    it("should validate status enum", () => {
      const invitationData = {
        projectId: "507f1f77bcf86cd799439011",
        projectTitle: "Test Project",
        ownerEmail: "owner@example.com",
        collaboratorEmail: "collaborator@example.com",
        status: "invalid",
      };

      expect(() => new Invitation(invitationData)).toThrow();
    });
  });
});
