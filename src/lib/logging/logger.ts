import "server-only";
import pino from "pino";

/** Paths redacted from every log line: credentials and personal data never reach logs. */
export const REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "headers.cookie",
  "cookie",
  "*.cookie",
  "phone",
  "*.phone",
  "email",
  "*.email",
  "address",
  "*.address",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "ucp", env: process.env.APP_ENV ?? "development" },
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
