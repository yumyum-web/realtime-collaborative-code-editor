import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock the database connection
jest.mock("@/app/lib/connectDB", () => jest.fn());

describe("Authentication Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret-key";
  });

  describe("Password Hashing", () => {
    it("should hash passwords correctly", async () => {
      const password = "testpassword";
      const hashed = await bcrypt.hash(password, 10);

      expect(hashed).not.toBe(password);
      expect(await bcrypt.compare(password, hashed)).toBe(true);
    });

    it("should reject incorrect passwords", async () => {
      const password = "testpassword";
      const hashed = await bcrypt.hash(password, 10);

      expect(await bcrypt.compare("wrongpassword", hashed)).toBe(false);
    });
  });

  describe("JWT Token", () => {
    it("should create and verify JWT tokens", () => {
      const payload = { userId: "123", username: "testuser" };
      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "1h",
      });

      expect(token).toBeDefined();

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!,
      ) as jwt.JwtPayload;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
    });

    it("should reject invalid tokens", () => {
      expect(() => {
        jwt.verify("invalid-token", process.env.JWT_SECRET!);
      }).toThrow();
    });

    it("should reject expired tokens", () => {
      const payload = { userId: "123", username: "testuser" };
      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "-1h",
      });

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET!);
      }).toThrow();
    });
  });
});
