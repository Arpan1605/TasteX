export function hashMockPassword(value: string): string {
  let hash = 2166136261;
  const input = `tx:${value}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `mock$${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
