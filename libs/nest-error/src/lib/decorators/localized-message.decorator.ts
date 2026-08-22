import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used to attach a success-message verb to a handler. Kept equal to
 * `@nest-util/nest-crud`'s `MESSAGE_KEY` so the existing `ResponseInterceptor`
 * reads it transparently. The verb is treated as a translation key (with literal
 * fallback) when `I18nService` is available.
 */
export const MESSAGE_KEY = 'customMessage';

export const LocalizedMessage = (message: string) =>
  SetMetadata(MESSAGE_KEY, message);
