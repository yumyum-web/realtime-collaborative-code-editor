import {
  colorFromString,
  hexToRgba,
  randomColor,
} from "@/app/editor/[id]/utils/colorHelpers";
import { describe, expect, it } from "@jest/globals";

describe("colorHelpers", () => {
  describe("colorFromString", () => {
    it("should generate consistent color from string", () => {
      const color1 = colorFromString("test");
      const color2 = colorFromString("test");

      expect(color1).toBe(color2);
      expect(color1).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should generate different colors for different strings", () => {
      const color1 = colorFromString("test1");
      const color2 = colorFromString("test2");

      expect(color1).not.toBe(color2);
      expect(color1).toMatch(/^#[0-9a-f]{6}$/);
      expect(color2).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should handle empty string", () => {
      const color = colorFromString("");
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should handle special characters", () => {
      const color = colorFromString("test@#$%^&*()");
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should handle long strings", () => {
      const longString = "a".repeat(1000);
      const color = colorFromString(longString);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe("hexToRgba", () => {
    it("should convert hex to rgba with default alpha", () => {
      const result = hexToRgba("#ff0000");
      expect(result).toBe("rgba(255,0,0,0.2)");
    });

    it("should convert hex to rgba with custom alpha", () => {
      const result = hexToRgba("#00ff00", 0.5);
      expect(result).toBe("rgba(0,255,0,0.5)");
    });

    it("should convert hex to rgba with zero alpha", () => {
      const result = hexToRgba("#0000ff", 0);
      expect(result).toBe("rgba(0,0,255,0)");
    });

    it("should convert hex to rgba with full alpha", () => {
      const result = hexToRgba("#ffff00", 1);
      expect(result).toBe("rgba(255,255,0,1)");
    });

    it("should handle lowercase hex", () => {
      const result = hexToRgba("#abcdef");
      expect(result).toBe("rgba(171,205,239,0.2)");
    });

    it("should handle uppercase hex", () => {
      const result = hexToRgba("#ABCDEF");
      expect(result).toBe("rgba(171,205,239,0.2)");
    });

    it("should handle mixed case hex", () => {
      const result = hexToRgba("#AbCdEf");
      expect(result).toBe("rgba(171,205,239,0.2)");
    });

    it("should handle black color", () => {
      const result = hexToRgba("#000000");
      expect(result).toBe("rgba(0,0,0,0.2)");
    });

    it("should handle white color", () => {
      const result = hexToRgba("#ffffff");
      expect(result).toBe("rgba(255,255,255,0.2)");
    });
  });

  describe("randomColor", () => {
    it("should return a color from predefined list", () => {
      const colors = ["#ff6b6b", "#6bc1ff", "#51d88a", "#fbbf24", "#9b5de5"];
      const result = randomColor();

      expect(colors).toContain(result);
    });

    it("should return valid hex color format", () => {
      const result = randomColor();
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should return consistent results in same execution context", () => {
      // Note: This test may be flaky in different environments
      // since Math.random() behavior can vary
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(randomColor());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe("integration tests", () => {
    it("should work together: string -> color -> rgba", () => {
      const username = "testuser";
      const hexColor = colorFromString(username);
      const rgbaColor = hexToRgba(hexColor, 0.8);

      expect(hexColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(rgbaColor).toMatch(/^rgba\(\d+,\d+,\d+,0\.8\)$/);
    });

    it("should generate different rgba for different users", () => {
      const user1 = hexToRgba(colorFromString("user1"));
      const user2 = hexToRgba(colorFromString("user2"));

      expect(user1).not.toBe(user2);
    });
  });
});
