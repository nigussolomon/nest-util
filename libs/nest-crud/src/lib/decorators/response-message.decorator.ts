import { SetMetadata } from '@nestjs/common';

export const MESSAGE_KEY = 'customMessage';
export const Message = (message: string) => SetMetadata(MESSAGE_KEY, message);

export const ENTITY_NAME_KEY = 'entityName';

export interface EntityNames {
  singular: string;
  plural: string;
}

export const EntityName = (names: string | EntityNames) =>
  SetMetadata(
    ENTITY_NAME_KEY,
    typeof names === 'string' ? { singular: names, plural: `${names}s` } : names
  );
