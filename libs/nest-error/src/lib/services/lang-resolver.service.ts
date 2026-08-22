import { Inject, Injectable } from '@nestjs/common';
import { LOCALIZATION_OPTIONS } from '../constants/tokens';
import type { LocalizationOptions } from '../interfaces/localization-options.interface';
import {
  negotiateLanguage,
  parseAcceptLanguage,
} from '../resolvers/accept-language.resolver';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Resolves the active language for a request from:
 *  1. `x-lang` header override (if `allowHeaderOverride` is enabled and valid)
 *  2. `Accept-Language` header (q-value negotiation), clamped to `supportedLangs`
 *  3. `defaultLang`
 */
@Injectable()
export class LangResolverService {
  private readonly defaultLang: string;
  private readonly supportedLangs: string[];
  private readonly allowHeaderOverride: boolean;

  constructor(
    @Inject(LOCALIZATION_OPTIONS) options: LocalizationOptions
  ) {
    this.defaultLang = options.defaultLang ?? 'en';
    this.supportedLangs = options.supportedLangs ?? [this.defaultLang];
    this.allowHeaderOverride = options.allowHeaderOverride ?? false;
  }

  resolve(request: RequestLike): string {
    if (this.allowHeaderOverride) {
      const override = this.firstHeader(request.headers['x-lang']);
      if (override) {
        const matched = negotiateLanguage(
          [override.toLowerCase()],
          this.supportedLangs
        );
        if (matched) return matched;
      }
    }

    const header = this.firstHeader(request.headers['accept-language']);
    const negotiated = negotiateLanguage(
      parseAcceptLanguage(header),
      this.supportedLangs
    );
    return negotiated ?? this.defaultLang;
  }

  private firstHeader(
    value: string | string[] | undefined
  ): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
  }
}
