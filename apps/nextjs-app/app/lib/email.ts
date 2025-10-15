import nodemailer from "nodemailer";

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const host = process.env.SMTP_HOST || "smtp-relay.brevo.com";
      const port = Number(process.env.SMTP_PORT || 587);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!user || !pass) {
        throw new Error(
          "Email sending disabled: missing SMTP_USER or SMTP_PASS",
        );
      }

      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587/2525
        auth: { user, pass },
      });
    })();
  }
  return transporterPromise;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  from,
}: SendEmailParams) {
  try {
    const transporter = await getTransporter();

    const sender =
      from ||
      process.env.SENDER_EMAIL ||
      process.env.SMTP_USER ||
      "no-reply@example.com";

    const info = await transporter.sendMail({
      from: sender,
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent:", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err);
    throw err;
  }
}

export default sendEmail;
