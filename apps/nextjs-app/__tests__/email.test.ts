import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from "@jest/globals";

// Mock console methods to suppress logs during tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Mock nodemailer
jest.mock("nodemailer", () => {
  const mockTransporter = {
    sendMail: jest.fn(),
  };
  return {
    createTransport: jest.fn(() => mockTransporter),
  };
});

describe("email utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Set up env vars for tests
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "password";
    process.env.SENDER_EMAIL = "sender@example.com";
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      jest.doMock("nodemailer", () => {
        const mockTransporter = {
          sendMail: jest.fn(),
        };
        return {
          createTransport: jest.fn(() => mockTransporter),
        };
      });
      const { sendEmail } = await import("@/app/lib/email");
      const nodemailer = await import("nodemailer");
      const transporter = jest.mocked(nodemailer).createTransport();
      const sendMail = transporter.sendMail as jest.Mock;
      sendMail.mockResolvedValue({
        messageId: "123",
      });

      await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
      });

      expect(transporter.sendMail).toHaveBeenCalledWith({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
        html: undefined,
      });
    });

    it("should handle multiple recipients", async () => {
      jest.doMock("nodemailer", () => {
        const mockTransporter = {
          sendMail: jest.fn(),
        };
        return {
          createTransport: jest.fn(() => mockTransporter),
        };
      });
      const { sendEmail } = await import("@/app/lib/email");
      const nodemailer = await import("nodemailer");
      const transporter = jest.mocked(nodemailer).createTransport();
      (transporter.sendMail as jest.Mock).mockResolvedValue({
        messageId: "123",
      });

      await sendEmail({
        to: ["recipient1@example.com", "recipient2@example.com"],
        subject: "Test Subject",
        text: "Test body",
      });

      expect(transporter.sendMail).toHaveBeenCalledWith({
        from: "sender@example.com",
        to: ["recipient1@example.com", "recipient2@example.com"],
        subject: "Test Subject",
        text: "Test body",
        html: undefined,
      });
    });

    it("should use custom from address", async () => {
      jest.doMock("nodemailer", () => {
        const mockTransporter = {
          sendMail: jest.fn(),
        };
        return {
          createTransport: jest.fn(() => mockTransporter),
        };
      });
      const { sendEmail } = await import("@/app/lib/email");
      const nodemailer = await import("nodemailer");
      const transporter = jest.mocked(nodemailer).createTransport();
      (transporter.sendMail as jest.Mock).mockResolvedValue({
        messageId: "123",
      });

      await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
        from: "custom@example.com",
      });

      expect(transporter.sendMail).toHaveBeenCalledWith({
        from: "custom@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
        html: undefined,
      });
    });

    it("should handle HTML content", async () => {
      jest.doMock("nodemailer", () => {
        const mockTransporter = {
          sendMail: jest.fn(),
        };
        return {
          createTransport: jest.fn(() => mockTransporter),
        };
      });
      const { sendEmail } = await import("@/app/lib/email");
      const nodemailer = await import("nodemailer");
      const transporter = jest.mocked(nodemailer).createTransport();
      (transporter.sendMail as jest.Mock).mockResolvedValue({
        messageId: "123",
      });

      await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      });

      expect(transporter.sendMail).toHaveBeenCalledWith({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        text: undefined,
        html: "<p>Test HTML</p>",
      });
    });

    it("should throw error when SMTP credentials are missing", async () => {
      const { sendEmail } = await import("@/app/lib/email");
      delete process.env.SMTP_USER;

      await expect(
        sendEmail({
          to: "recipient@example.com",
          subject: "Test Subject",
          text: "Test body",
        }),
      ).rejects.toThrow(
        "Email sending disabled: missing SMTP_USER or SMTP_PASS",
      );
    });

    it("should throw error on send failure", async () => {
      jest.doMock("nodemailer", () => {
        const mockTransporter = {
          sendMail: jest.fn(),
        };
        return {
          createTransport: jest.fn(() => mockTransporter),
        };
      });
      const { sendEmail } = await import("@/app/lib/email");
      const nodemailer = await import("nodemailer");
      const transporter = jest.mocked(nodemailer).createTransport();
      (transporter.sendMail as jest.Mock).mockRejectedValue(
        new Error("Send failed"),
      );

      await expect(
        sendEmail({
          to: "recipient@example.com",
          subject: "Test Subject",
          text: "Test body",
        }),
      ).rejects.toThrow("Send failed");
    });
  });
});
