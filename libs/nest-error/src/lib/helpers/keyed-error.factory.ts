import { HttpException } from '@nestjs/common';
import { defaultMessages } from '../constants/default-messages';
import { pickNestClass } from '../constants/http-status-map';

/**
 * Build a keyed exception.
 *
 * Returns the **real** matching NestJS exception class (e.g. `NotFoundException`)
 * so existing `expect(...).rejects.toThrow(NotFoundException)` assertions keep
 * passing after migration. The response object carries `{ errorKey, params,
 * details, message }`.
 */
export function keyed(
  status: number,
  code: string,
  params?: Record<string, unknown>,
  safeDetails?: Record<string, unknown>
): HttpException {
  const NestClass = pickNestClass(status);
  const message = defaultMessages[code] ?? 'An unexpected error occurred';
  return new NestClass({
    errorKey: code,
    params: params ?? null,
    details: safeDetails ?? null,
    message,
  });
}

/**
 * App-level custom error. Thrown like a normal `HttpException` but carries a
 * stable `errorKey` so the `LocalizedExceptionFilter` can localize it identically.
 */
export class AppError extends HttpException {
  public readonly errorKey: string;
  public readonly safeParams: Record<string, unknown> | null;
  public readonly safeDetails: Record<string, unknown> | null;

  constructor(
    status: number,
    code: string,
    params?: Record<string, unknown>,
    safeDetails?: Record<string, unknown>,
    message?: string
  ) {
    const resolved = message ?? defaultMessages[code] ?? 'An unexpected error occurred';
    super(
      {
        errorKey: code,
        params: params ?? null,
        details: safeDetails ?? null,
        message: resolved,
      },
      status
    );
    this.errorKey = code;
    this.safeParams = params ?? null;
    this.safeDetails = safeDetails ?? null;
  }
}
