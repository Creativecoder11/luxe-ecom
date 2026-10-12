import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/** Object storage port (D-011). Keys are generated server-side, never taken from user input. */
export interface StorageDriver {
  readonly name: string;
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9]+(?:\/[a-zA-Z0-9_-]+)+\.(?:jpg|png|webp)$/;

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes("..");
}

/** Development-only driver storing files under STORAGE_LOCAL_DIR (rejected in production by env validation). */
export class LocalDiskStorage implements StorageDriver {
  readonly name = "local";
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" });
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const config = env();
  if (config.STORAGE_DRIVER === "s3") {
    // Not implemented: requires a bucket, credentials and a signed-URL policy decision (STATUS.md: blocked).
    throw new Error("The S3 storage driver is not implemented yet. Configure a bucket and implement src/lib/storage/s3.ts.");
  }
  driver = new LocalDiskStorage(config.STORAGE_LOCAL_DIR);
  return driver;
}
