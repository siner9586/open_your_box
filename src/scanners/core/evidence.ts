export function evidenceRef(source: string, id: string) {
  return `${source}:${id}`;
}
export function summarizeEvidence(value: string, max = 160) {
  return String(value || '').slice(0, max);
}
