export interface ApiKeyModuleOptions {
  /**
   * Enable API key authentication.
   * @default false
   */
  enabled?: boolean;

  /**
   * Header name to look for the API key.
   * @default 'x-api-key'
   */
  headerName?: string;

  /**
   * Prefix for generated API keys.
   * @default 'nuk_live_'
   */
  keyPrefix?: string;

  /**
   * Number of bcrypt hash rounds.
   * @default 10
   */
  hashRounds?: number;
}
