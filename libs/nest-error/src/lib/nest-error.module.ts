import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LocalizedExceptionFilter } from './filters/localized-exception.filter';
import { I18nService } from './services/i18n.service';
import { LangResolverService } from './services/lang-resolver.service';
import { LOCALIZATION_OPTIONS } from './constants/tokens';
import type { LocalizationOptions } from './interfaces/localization-options.interface';

/**
 * Registers the i18n service, language resolver, and a global
 * `LocalizedExceptionFilter` (via `APP_FILTER`) so every error is rendered as a
 * standardized, localized, generic JSON body.
 */
@Global()
@Module({})
export class LocalizationModule {
  static forRoot(options: LocalizationOptions): DynamicModule {
    return {
      module: LocalizationModule,
      global: true,
      providers: [
        { provide: LOCALIZATION_OPTIONS, useValue: options },
        I18nService,
        LangResolverService,
        {
          provide: APP_FILTER,
          useClass: LocalizedExceptionFilter,
        },
      ],
      exports: [I18nService, LangResolverService, LOCALIZATION_OPTIONS],
    };
  }
}
