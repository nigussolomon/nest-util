import {
  ArgumentMetadata,
  PipeTransform,
  Type,
  ValidationPipe,
} from '@nestjs/common';

/**
 * Pass-through pipe used when DTO validation is explicitly disabled.
 */
export class NoopPipe implements PipeTransform {
  transform(value: unknown) {
    return value;
  }
}


/**
 * Enforces `class-validator` rules declared on a DTO class for a request body,
 * even when the controller method is typed with a generic (which NestJS
 * otherwise erases to `Object`, causing `ValidationPipe` to skip validation).
 *
 * Uses `transform: false` so the original plain object is passed through to the
 * service unchanged — only validation is enforced.
 */
export class DtoValidationPipe implements PipeTransform {
  private readonly validationPipe: ValidationPipe;

  constructor(private readonly dto: Type<unknown>) {
    this.validationPipe = new ValidationPipe({ transform: false });
  }

  transform(value: unknown, metadata: ArgumentMetadata) {
    return this.validationPipe.transform(value, {
      ...metadata,
      metatype: this.dto,
    });
  }
}
