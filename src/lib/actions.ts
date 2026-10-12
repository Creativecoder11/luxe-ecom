import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { DomainError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { zodFieldErrors } from "@/lib/zod-errors";

import type { ActionResult, FormValues } from "./action-result";

export type { ActionResult, FormValues } from "./action-result";

export { zodFieldErrors };

/**
 * Runs a server action body and converts expected failures into a typed result.
 * Unexpected errors are logged and reported generically (no internals leak to the client).
 * Next.js control-flow errors (redirect/notFound) are re-thrown.
 */
export async function runAction<T>(fn: () => Promise<T>, options: { message?: string } = {}): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, ...(options.message ? { message: options.message } : {}) };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof z.ZodError) {
      return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(error) };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (error instanceof DomainError) return { ok: false, error: error.message };
    logger.error({ err: error }, "server action failed");
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Reads a FormData into a plain object (repeated keys become arrays). */
export function formToObject(form: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return out;
}

/**
 * React 19 resets a form after its action completes. On failure, echo back the listed
 * non-secret fields so forms can restore them via defaultValue. Never include passwords.
 */
export function keepValues<T>(result: ActionResult<T>, form: FormData, keys: readonly string[]): ActionResult<T> {
  if (result.ok) return result;
  const values: FormValues = {};
  for (const key of keys) {
    const all = form.getAll(key).filter((v): v is string => typeof v === "string");
    if (all.length > 1) values[key] = all;
    else if (all.length === 1) values[key] = all[0]!;
  }
  return { ...result, values };
}

