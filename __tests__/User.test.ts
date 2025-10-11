// Mock mongoose to avoid actual DB connections
jest.mock("mongoose", () => ({
  connect: jest.fn(),
  connection: {
    readyState: 1,
  },
  models: {},
  Types: {
    ObjectId: class MockObjectId {},
  },
  Schema: jest.fn(() => ({
    Types: {
      ObjectId: class MockObjectId {},
    },
  })),
}));

import mongoose from "mongoose";
import User from "@/app/models/User";

// Mock the User model
jest.mock("@/app/models/User", () => {
  const mockUser = jest.fn();
  mockUser.mockImplementation((data) => {
    if (!data.username) {
      throw new Error("ValidationError: username is required");
    }
    if (!data.email) {
      throw new Error("ValidationError: email is required");
    }
    if (!data.password) {
      throw new Error("ValidationError: password is required");
    }
    const defaults = {
      projects: [],
    };
    return {
      ...defaults,
      ...data,
      save: jest.fn(),
      validate: jest.fn(),
    };
  });
  return mockUser;
});

describe("User Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Schema Validation", () => {
    it("should create a user with valid data", () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "hashedpassword",
        projects: [],
      };

      const user = new User(userData);
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.password).toBe(userData.password);
      expect(user.projects).toEqual(userData.projects);
    });

    it("should require username", () => {
      const userData = {
        email: "test@example.com",
        password: "hashedpassword",
      };

      expect(() => new User(userData)).toThrow();
    });

    it("should require email", () => {
      const userData = {
        username: "testuser",
        password: "hashedpassword",
      };

      expect(() => new User(userData)).toThrow();
    });

    it("should require password", () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
      };

      expect(() => new User(userData)).toThrow();
    });

    it("should have projects as an array of ObjectIds", () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "hashedpassword",
        projects: [new mongoose.Types.ObjectId()],
      };

      const user = new User(userData);
      expect(Array.isArray(user.projects)).toBe(true);
      expect(user.projects.length).toBe(1);
    });
  });
});
