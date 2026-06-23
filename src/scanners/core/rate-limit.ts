export function bucketKey(parts: string[]) {
  return parts.filter(Boolean).join(':');
}
export function nextReset(seconds = 60) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
