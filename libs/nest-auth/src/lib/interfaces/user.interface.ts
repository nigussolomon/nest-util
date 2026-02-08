export class AuthUser {
  id!: number | string;
  [key: string]: unknown;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}
