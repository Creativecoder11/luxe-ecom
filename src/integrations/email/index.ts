/**
 * Email delivery port. Only real provider responses may report SENT; an unconfigured
 * sender always reports NOT_SENT so no flow can claim an email went out.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailDeliveryResult =
  | { status: "SENT"; provider: string; providerMessageId: string }
  | { status: "NOT_SENT"; provider: string; reason: "UNCONFIGURED" | "FAILED"; detail?: string };

export interface EmailSender {
  readonly provider: string;
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

export const unconfiguredEmailSender: EmailSender = {
  provider: "none",
  isConfigured: () => false,
  send: async () => ({ status: "NOT_SENT", provider: "none", reason: "UNCONFIGURED" }),
};

export function getEmailSender(): EmailSender {
  // Providers (SMTP/API) are added when one is contracted; EMAIL_PROVIDER currently only allows "none".
  return unconfiguredEmailSender;
}
