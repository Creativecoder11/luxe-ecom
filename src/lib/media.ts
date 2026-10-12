/** Public URL for a stored media object (served by src/app/media/[...key]/route.ts). */
export function mediaUrl(storageKey: string): string {
  return `/media/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}
