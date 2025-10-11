import jwt from "jsonwebtoken";
import { verifyJWT } from "@/app/utils/verifyJWT";

describe("verifyJWT", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-key";
  });

  it("should verify valid JWT token and return payload", () => {
    const payload = {
      userId: "123",
      username: "testuser",
      email: "test@example.com",
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    const result = verifyJWT(token);

    expect(result).toMatchObject(payload);
    expect(result).toHaveProperty("iat");
    expect(result).toHaveProperty("exp");
  });

  it("should return null for invalid token", () => {
    const result = verifyJWT("invalid-token");
    expect(result).toBeNull();
  });

  it("should return null for expired token", () => {
    const payload = { userId: "123", username: "testuser" };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "-1h",
    });

    const result = verifyJWT(token);
    expect(result).toBeNull();
  });

  it("should return null for token signed with wrong secret", () => {
    const payload = { userId: "123", username: "testuser" };
    const token = jwt.sign(payload, "wrong-secret");

    const result = verifyJWT(token);
    expect(result).toBeNull();
  });

  it("should return null when JWT_SECRET is not set", () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    const payload = { userId: "123", username: "testuser" };
    const token = jwt.sign(payload, "test-secret-key");

    const result = verifyJWT(token);

    expect(result).toBeNull();

    // Restore the secret
    process.env.JWT_SECRET = originalSecret;
  });

  it("should handle malformed JWT tokens gracefully", () => {
    const result = verifyJWT("not.a.jwt.token");
    expect(result).toBeNull();
  });

  it("should handle empty token string", () => {
    const result = verifyJWT("");
    expect(result).toBeNull();
  });
});
