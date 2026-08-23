import type { EntityMetadata } from 'typeorm';

/**
 * Expands modification-field dot paths into every relation prefix required to
 * load the referenced values, so relation fields (e.g. `addresses` or
 * `company.addresses.city`) can be read without the consumer configuring
 * `include`.
 *
 * Non-relation columns yield nothing. Unknown paths are ignored.
 */
export function resolveRelationPaths(
  metadata: EntityMetadata,
  fields: readonly string[]
): string[] {
  const resolved = new Set<string>();

  for (const field of fields) {
    if (!field) {
      continue;
    }
    const segments = field.split('.');
    let relations = metadata.relations ?? [];
    let prefix: string[] = [];

    for (const segment of segments) {
      const match = relations.find(
        (relation) => relation.propertyName === segment
      );
      if (!match) {
        break;
      }
      prefix = [...prefix, match.propertyName];
      resolved.add(prefix.join('.'));
      relations = match.inverseEntityMetadata.relations;
    }
  }

  return [...resolved];
}

/** Checks whether a (root) property name exists on the entity as a column,
 * embedded column, or relation. */
export function isKnownProperty(
  metadata: EntityMetadata,
  propertyName: string
): boolean {
  return (
    (metadata.columns ?? []).some(
      (column) =>
        column.propertyPath === propertyName ||
        column.propertyPath.startsWith(`${propertyName}.`)
    ) ||
    (metadata.relations ?? []).some((relation) => relation.propertyName === propertyName)
  );
}

/**
 * Normalizes a captured modification value so it is always jsonb-serializable
 * and distinguishable from "not loaded": `undefined` becomes explicit `null`.
 */
export function normalizeCapturedValue(value: unknown): unknown {
  return value === undefined ? null : value;
}
