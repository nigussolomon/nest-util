/** Options for `LocalizationModule.forRoot(...)`. */
export interface LocalizationOptions {
  /**
   * User-supplied message map: `lang -> code -> template`. Deep-merged over the
   * library's generic `defaultMessages`, so an app only supplies the
   * languages/overrides it cares about.
   */
  messages: Record<string, Record<string, string>>;
  /** Fallback language. Defaults to `'en'`. */
  defaultLang?: string;
  /** Languages the app supports (used to clamp `Accept-Language`). */
  supportedLangs?: string[];
  /** Fall back to `defaultLang` when a key is missing in the active language. Default `true`. */
  fallbackToDefault?: boolean;
  /** Allow an `x-lang` header to override `Accept-Language`. Default `false`. */
  allowHeaderOverride?: boolean;
  /**
   * When `true`, `details`/`params`/stack are included in the client response.
   * Default `false` (redacted in production).
   */
  debug?: boolean;
}
