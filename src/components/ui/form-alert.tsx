import { Alert } from "./display";

interface ResultLike {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Form-level outcome of a server action (field errors are shown next to fields). */
export function FormAlert({ state }: { state: ResultLike | null | undefined }) {
  if (!state) return null;
  if (!state.ok && state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.ok && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}
