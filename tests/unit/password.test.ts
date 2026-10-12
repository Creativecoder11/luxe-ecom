import { hashPassword as betterAuthHash, verifyPassword as betterAuthVerify } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing (node:crypto scrypt)", () => {
  it("verifies correct and rejects wrong passwords", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyPassword({ hash, password: "correct horse battery" })).toBe(true);
    expect(await verifyPassword({ hash, password: "wrong horse battery" })).toBe(false);
  });

  it("is interchangeable with Better Auth's format in both directions", async () => {
    const ours = await hashPassword("shared-secret-123");
    expect(await betterAuthVerify({ hash: ours, password: "shared-secret-123" })).toBe(true);
    const theirs = await betterAuthHash("shared-secret-123");
    expect(await verifyPassword({ hash: theirs, password: "shared-secret-123" })).toBe(true);
  });

  it("normalizes Unicode (NFKC) and rejects malformed hashes without throwing", async () => {
    const hash = await hashPassword("ﬁle-password-1"); // U+FB01 ligature normalizes to "fi"
    expect(await verifyPassword({ hash, password: "file-password-1" })).toBe(true);
    expect(await verifyPassword({ hash: "garbage", password: "x" })).toBe(false);
    expect(await verifyPassword({ hash: "abc:zz", password: "x" })).toBe(false);
  });

  it("does not block the event loop while hashing", async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 5);
    const started = performance.now();
    await Promise.all([hashPassword("a-password-1"), hashPassword("b-password-1"), hashPassword("c-password-1")]);
    const elapsed = performance.now() - started;
    clearInterval(timer);
    // A blocked loop would record almost no ticks; allow generous slack for slow CI machines.
    expect(ticks).toBeGreaterThan(elapsed / 5 / 3);
  });
});
