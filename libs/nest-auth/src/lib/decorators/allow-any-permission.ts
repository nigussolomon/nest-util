import { SetMetadata } from '@nestjs/common';
import { ALLOW_ANY_PERMISSION_KEY } from '../constants';

export const AllowAnyPermission = () =>
  SetMetadata(ALLOW_ANY_PERMISSION_KEY, true);
