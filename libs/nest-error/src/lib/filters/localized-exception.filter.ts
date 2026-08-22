import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorKey } from '../constants/error-keys';
import type { ErrorResponse } from '../interfaces/error-response.interface';
import { I18nService } from '../services/i18n.service';
import { LangResolverService } from '../services/lang-resolver.service';

interface DatabaseErrorLike {
  code?: string;
  errno?: number;
  detail?: string;
}

function isHttpException(e: unknown): e is HttpException {
  return e instanceof HttpException;
}

function isQueryFailedError(e: unknown): e is Error & { driverError?: DatabaseErrorLike } {
  return e instanceof Error && 'driverError' in e && (e as { driverError?: unknown }).driverError != null;
}

function asObject(res: string | object): Record<string, unknown> {
  return typeof res === 'string' ? { message: res } : (res as Record<string, unknown>);
}

/**
 * Catch-all exception filter that renders every error as a standardized,
 * localized, **generic** JSON body driven by the configured message map.
 *
 * - `keyed()` / `AppError` exceptions carry an `errorKey` and are localized.
 * - `QueryFailedError` (unique violations) maps to `DB_DUPLICATE_ENTRY` with no
 *   SQL leaked to the client (detail is logged server-side only).
 * - Other `HttpException`s get a status-based fallback `code` so every response
 *   carries a `code`.
 * - Unknown errors become `INTERNAL_ERROR` (generic message, full log server-side).
 *
 * `details`/`params`/stack are stripped from the client response unless `debug`.
 */
@Catch()
export class LocalizedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(LocalizedExceptionFilter.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly langResolver: LangResolverService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const path = request?.url ?? '';
    const lang = this.langResolver.resolve(request ?? ({ headers: {} } as Request));

    const result = this.classify(exception);
    const statusCode = result.statusCode;

    const message = result.localized
      ? this.i18n.translate(result.code, result.params, lang)
      : result.fallbackMessage ?? this.i18n.translate(result.code, result.params, lang);

    // Always log server-side context for debugging.
    this.logger.error(
      `[${result.code}] ${message}`,
      JSON.stringify({
        params: result.params ?? null,
        detail: result.serverDetail ?? null,
        original: result.serverDetail ?? (exception as Error)?.message ?? null,
        stack: (exception as Error)?.stack ?? null,
        path,
      })
    );

    const body: ErrorResponse = {
      status: 'error',
      code: result.code,
      message,
      statusCode,
      details: result.debugDetails ?? null,
      timestamp: new Date().toISOString(),
      path,
    };

    response.status(statusCode).json(body);
  }

  private classify(exception: unknown): ClassifiedError {
    const debug = this.isDebug();
    const safeDetails = (d?: Record<string, unknown> | null) =>
      debug ? (d ?? null) : null;

    // 1. keyed HttpException (keyed() / AppError)
    if (isHttpException(exception)) {
      const status = exception.getStatus();
      const res = asObject(exception.getResponse());
      const errorKey = res['errorKey'];
      if (typeof errorKey === 'string') {
        const params = (res['params'] as Record<string, unknown> | null) ?? undefined;
        const details = res['details'] as Record<string, unknown> | null;
        return {
          code: errorKey,
          statusCode: status,
          params,
          localized: true,
          debugDetails: safeDetails(details),
          serverDetail: (res['message'] as string) ?? null,
        };
      }

      // 2. non-keyed HttpException -> status-based fallback key
      const fallbackKey = this.fallbackKeyForStatus(status);
      const originalMessage =
        typeof res['message'] === 'string'
          ? (res['message'] as string)
          : undefined;
      return {
        code: fallbackKey,
        statusCode: status,
        localized: false,
        fallbackMessage: originalMessage,
        serverDetail: originalMessage ?? null,
      };
    }

    // 3. QueryFailedError (TypeORM) — unique violation -> DB_DUPLICATE_ENTRY
    if (isQueryFailedError(exception)) {
      const driverError = exception.driverError;
      const isUnique =
        driverError?.code === '23505' || driverError?.errno === 1062;
      if (isUnique) {
        return {
          code: ErrorKey.DB_DUPLICATE_ENTRY,
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          localized: true,
          serverDetail: driverError?.detail ?? null,
        };
      }
      return {
        code: ErrorKey.DB_QUERY_FAILED,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        localized: true,
        serverDetail: driverError?.detail ?? exception.message ?? null,
      };
    }

    // 4. Unknown error -> INTERNAL_ERROR
    return {
      code: ErrorKey.INTERNAL_ERROR,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      localized: true,
      serverDetail: (exception as Error)?.message ?? null,
    };
  }

  private fallbackKeyForStatus(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return ErrorKey.VALIDATION_FAILED;
    if (status === HttpStatus.NOT_FOUND) return ErrorKey.NOT_FOUND;
    if (status === HttpStatus.UNAUTHORIZED) return ErrorKey.AUTH_UNAUTHORIZED;
    if (status === HttpStatus.FORBIDDEN) return ErrorKey.AUTH_PERMISSION_DENIED;
    return ErrorKey.UNKNOWN_ERROR;
  }

  private isDebug(): boolean {
    return this.i18n.isDebug();
  }
}

interface ClassifiedError {
  code: string;
  statusCode: number;
  params?: Record<string, unknown>;
  localized: boolean;
  fallbackMessage?: string;
  debugDetails?: Record<string, unknown> | null;
  serverDetail?: string | null;
}
