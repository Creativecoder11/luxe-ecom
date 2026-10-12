import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env/schema";

const base = { DATABASE_URL: "postgresql://u@localhost:5432/ucp_dev", AUTH_SECRET: "x".repeat(32) };

const prod = { APP_ENV: "production", APP_URL: "https://shop.example", STORAGE_DRIVER: "s3" };

describe("server environment validation", () => {
  it("applies safe defaults", () => {
    const env = parseServerEnv(base);
    expect(env.APP_ENV).toBe("development");
    expect(env.SHELL_PREVIEW).toBe(false);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("requires a postgres DATABASE_URL", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseServerEnv({ DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  it("rejects the unauthenticated shell preview in production", () => {
    expect(() =>
      parseServerEnv({ ...base, ...prod, SHELL_PREVIEW: "true" }),
    ).toThrow(/SHELL_PREVIEW/);
  });

  it("requires https APP_URL in production", () => {
    expect(() => parseServerEnv({ ...base, ...prod, APP_URL: "http://shop.example" })).toThrow(/APP_URL/);
    expect(parseServerEnv({ ...base, ...prod }).APP_ENV).toBe("production");
  });

  it("requires a strong auth secret", () => {
    expect(() => parseServerEnv({ ...base, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
  });

  it("rejects local file storage in production", () => {
    expect(() => parseServerEnv({ ...base, ...prod, STORAGE_DRIVER: "local" })).toThrow(/STORAGE_DRIVER/);
  });

  it("refuses a test database equal to the main database", () => {
    expect(() => parseServerEnv({ ...base, TEST_DATABASE_URL: base.DATABASE_URL })).toThrow(/TEST_DATABASE_URL/);
  });
});
