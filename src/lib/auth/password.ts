import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing on node:crypto scrypt (libuv thread pool, never blocks the event loop).
 *
 * Why not Better Auth's default: under the Next.js server bundle its export conditions resolve
 * to a pure-JavaScript scrypt that runs on the main thread, stalling every concurrent request
 * during sign-in (measured 0.3–1 s event-loop blocks). Format and parameters are identical to
 * Better Auth's (`saltHex:keyHex`, N=16384, r=16, p=1, 64-byte key), so hashes are interchangeable.
 */
const PARAMS = { N: 16384, r: 16, p: 1, keyLength: 64 } as const;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      PARAMS.keyLength,
      { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: 128 * PARAMS.N * PARAMS.r * 2 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  const [salt, keyHex] = hash.split(":");
  if (!salt || !keyHex || !/^[0-9a-f]+$/i.test(keyHex)) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== PARAMS.keyLength) return false;
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(actual, expected);
}
