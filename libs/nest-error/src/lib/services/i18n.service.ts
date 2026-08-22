import { Inject, Injectable } from '@nestjs/common';
import { defaultMessages } from '../constants/default-messages';
import { LOCALIZATION_OPTIONS } from '../constants/tokens';
import type { LocalizationOptions } from '../interfaces/localization-options.interface';
import type { I18nService as I18nServiceInterface } from '../interfaces/i18n.interface';

/**
 * Translation service. Deep-merges the user-supplied JSON messages over the
 * library's generic `defaultMessages` and supports `{placeholder}` interpolation
 * with safe (non-user-input) values.
 */
@Injectable()
export class I18nService implements I18nServiceInterface {
  private readonly merged: Record<string, Record<string, string>>;
  private readonly defaultLang: string;
  private readonly supportedLangs: string[];
  private readonly fallbackToDefault: boolean;

  constructor(
    @Inject(LOCALIZATION_OPTIONS) private readonly options: LocalizationOptions
  ) {
    this.defaultLang = options.defaultLang ?? 'en';
    this.fallbackToDefault = options.fallbackToDefault ?? true;
    this.supportedLangs = Array.from(
      new Set([this.defaultLang, ...(options.supportedLangs ?? [])])
    );

    // Seed with the library defaults for every supported language, then overlay
    // the user's JSON config.
    this.merged = {};
    for (const lang of this.supportedLangs) {
      this.merged[lang] = { ...defaultMessages };
    }
    for (const [lang, codes] of Object.entries(options.messages ?? {})) {
      this.merged[lang] = { ...(this.merged[lang] ?? {}), ...codes };
    }
  }

  getDefaultLang(): string {
    return this.defaultLang;
  }

  getSupportedLangs(): string[] {
    return [...this.supportedLangs];
  }

  /** Whether debug mode (client-exposed details/params) is enabled. */
  isDebug(): boolean {
    return this.options.debug === true;
  }

  hasKey(code: string, lang?: string): boolean {
    const language = lang ?? this.defaultLang;
    if (this.merged[language]?.[code]) return true;
    return this.fallbackToDefault ? !!this.merged[this.defaultLang]?.[code] : false;
  }

  translate(
    code: string,
    params?: Record<string, unknown>,
    lang?: string
  ): string {
    const language = lang ?? this.defaultLang;
    const template =
      this.merged[language]?.[code] ??
      (this.fallbackToDefault ? this.merged[this.defaultLang]?.[code] : undefined) ??
      code;

    return this.interpolate(template, params);
  }

  private interpolate(
    template: string,
    params?: Record<string, unknown>
  ): string {
    if (!params || Object.keys(params).length === 0) return template;
    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
      return params[key] !== undefined && params[key] !== null
        ? String(params[key])
        : match;
    });
  }
}
