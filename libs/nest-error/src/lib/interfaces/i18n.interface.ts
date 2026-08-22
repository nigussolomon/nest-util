/** Minimal i18n surface consumed by the filter and interceptors. */
export interface I18nService {
  /** Translate a code/key into the active language, interpolating `{placeholder}`s. */
  translate(
    code: string,
    params?: Record<string, unknown>,
    lang?: string
  ): string;
  /** Whether a translation exists for `code` in `lang` (or via fallback). */
  hasKey(code: string, lang?: string): boolean;
  /** The configured default language. */
  getDefaultLang(): string;
  /** Supported languages (clamped set). */
  getSupportedLangs(): string[];
}
