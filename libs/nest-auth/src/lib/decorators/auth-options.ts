import { Inject } from '@nestjs/common';
import { AUTH_OPTIONS } from '../constants';

export const AuthOptions = () => Inject(AUTH_OPTIONS);
