import { SetMetadata } from '@nestjs/common';

export const FILE_OWNER_KEY = 'file_owner_key';

export const FileOwnerEntity = (ownerType: string) =>
  SetMetadata(FILE_OWNER_KEY, ownerType);
