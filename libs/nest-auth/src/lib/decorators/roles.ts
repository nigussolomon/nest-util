import { SetMetadata } from '@nestjs/common';
import { ALLOWED_ROLES_KEY } from '../constants';

export const AllowRoles = (...roles: string[]) =>
  SetMetadata(ALLOWED_ROLES_KEY, roles);
