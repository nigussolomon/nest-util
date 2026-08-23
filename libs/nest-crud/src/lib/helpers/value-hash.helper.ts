import { createHash } from 'crypto';

/**
 * Produces a deterministic, stable serialization of an arbitrary value so it
 * can be hashed consistently across processes and after jsonb round-trips:
 * - object keys are sorted recursively
 * - Date instances become ISO strings
 * - undefined / null / missing all normalize to null
 * - arrays are order-insensitive: elements are hashed by their own canonical
 *   form and the resulting strings are sorted (a reordered-but-identical
 *   collection hashes equal — change detection, not order verification)
 * - circular references become the string '[Circular]'
 */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (node: unknown): unknown => {
    if (node === undefined || node === null) {
      return null;
    }
    if (node instanceof Date) {
      return Number.isNaN(node.getTime()) ? null : node.toISOString();
    }
    if (typeof node === 'object') {
      if (seen.has(node as object)) {
        return '[Circular]';
      }
      seen.add(node as object);
      if (Array.isArray(node)) {
        const items = node
          .map((item) => JSON.stringify(walk(item)))
          .sort()
          .map((item) => JSON.parse(item));
        return { __set: items };
      }
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(node as Record<string, unknown>).sort()) {
        out[key] = walk((node as Record<string, unknown>)[key]);
      }
      return out;
    }
    return node;
  };
  return JSON.stringify(walk(value));
}

/** SHA-256 hex hash of a value's canonical JSON form. */
export function hashValue(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/** Structural equality used as legacy fallback when no hash is stored. */
export function deepEqual(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
