import { jest, describe, beforeEach, it, expect } from "@jest/globals";

// Mock mongoose
jest.mock("mongoose");

describe("mongoose utility", () => {
  beforeEach(() => {
    jest.resetModules();
    // Reset global cache
    (
      global as typeof global & { mongoose?: { conn: null; promise: null } }
    ).mongoose = { conn: null, promise: null };
    process.env.MONGO_URI = "mongodb://localhost:27017/test";
  });

  describe("connectDB", () => {
    it("should connect to MongoDB and cache the connection", async () => {
      jest.doMock("mongoose", () => {
        const mockConnect = jest.fn();
        return { connect: mockConnect };
      });
      const { default: connectDB } = await import("../connectDB");
      const mongoose = (await import("mongoose")) as jest.Mocked<
        typeof import("mongoose")
      >;
      mongoose.connect.mockResolvedValue(mongoose);

      const result1 = await connectDB();
      const result2 = await connectDB();

      expect(mongoose.connect).toHaveBeenCalledTimes(1);
      expect(mongoose.connect).toHaveBeenCalledWith(
        "mongodb://localhost:27017/test",
        {
          bufferCommands: false,
        },
      );
      expect(result1).toBe(mongoose);
      expect(result2).toBe(mongoose); // Should return cached connection
    });

    it("should throw error if MONGO_URI is not defined", async () => {
      delete process.env.MONGO_URI;

      const { default: connectDB } = await import("../connectDB");

      await expect(connectDB()).rejects.toThrow(
        "Please define the MONGO_URI environment variable.",
      );
    });

    it("should handle connection errors", async () => {
      jest.doMock("mongoose", () => {
        const mockConnect = jest.fn<() => Promise<never>>();
        mockConnect.mockRejectedValue((new Error("Connection failed")));
        return { connect: mockConnect };
      });
      const { default: connectDB } = await import("../connectDB");
      const mongoose = await import("mongoose");

      await expect(connectDB()).rejects.toThrow("Connection failed");
    });
  });
});
