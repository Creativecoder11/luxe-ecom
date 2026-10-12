/** Server action result shared by server actions and client forms (client-safe module). */
export type FormValues = Record<string, string | string[]>;

export type ActionResult<T = void> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; values?: FormValues };

/** Reads one echoed value (see keepValues) for an input's defaultValue. */
export function echoed(state: ActionResult<unknown> | null | undefined, key: string): string | undefined {
  if (!state || state.ok || !state.values) return undefined;
  const value = state.values[key];
  return Array.isArray(value) ? value[0] : value;
}

export function echoedAll(state: ActionResult<unknown> | null | undefined, key: string): string[] | undefined {
  if (!state || state.ok || !state.values) return undefined;
  const value = state.values[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
