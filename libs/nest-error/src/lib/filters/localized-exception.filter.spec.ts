import { BadRequestException } from '@nestjs/common';
import { ErrorKey } from '../constants/error-keys';
import { LocalizedExceptionFilter } from './localized-exception.filter';
import { keyed } from '../helpers/keyed-error.factory';

interface FakeI18n {
  translate: jest.Mock;
  isDebug: jest.Mock;
  getDefaultLang: () => string;
  getSupportedLangs: () => string[];
  hasKey: () => boolean;
}

function runFilter(
  exception: unknown,
  opts: { debug?: boolean; lang?: string } = {}
) {
  const i18n: FakeI18n = {
    translate: jest.fn((code: string, _p?: unknown, lang?: string) => `[${lang ?? 'en'}]${code}`),
    isDebug: jest.fn(() => opts.debug ?? false),
    getDefaultLang: () => 'en',
    getSupportedLangs: () => ['en', 'am'],
    hasKey: () => true,
  };
  const langResolver = { resolve: jest.fn(() => opts.lang ?? 'am') };

  const filter = new LocalizedExceptionFilter(i18n as any, langResolver as any);
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as unknown as (code: number) => any;
  const response = { status } as any;
  const request = { url: '/api/post/999', headers: {} } as any;
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as any;

  filter.catch(exception, host);
  return {
    body: json.mock.calls[0][0] as Record<string, unknown>,
    statusCode: (status as jest.Mock).mock.calls[0][0],
  };
}

describe('LocalizedExceptionFilter', () => {
  it('localizes a keyed exception using the negotiated language', () => {
    const ex = keyed(404, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
    const { body, statusCode } = runFilter(ex, { lang: 'am' });
    expect(statusCode).toBe(404);
    expect(body['code']).toBe(ErrorKey.CRUD_RESOURCE_NOT_FOUND);
    expect(body['message']).toBe(`[am]${ErrorKey.CRUD_RESOURCE_NOT_FOUND}`);
    expect(body['status']).toBe('error');
    expect(body['path']).toBe('/api/post/999');
    expect(typeof body['timestamp']).toBe('string');
  });

  it('maps non-keyed HttpException to a status-based fallback key', () => {
    const ex = new BadRequestException('Some validation text');
    const { body, statusCode } = runFilter(ex);
    expect(statusCode).toBe(400);
    expect(body['code']).toBe(ErrorKey.VALIDATION_FAILED);
    // original (safe) message is preserved for non-keyed exceptions
    expect(body['message']).toBe('Some validation text');
  });

  it('maps QueryFailedError 23505 to DB_DUPLICATE_ENTRY without leaking detail', () => {
    const e = new Error('duplicate') as Error & { driverError: any };
    e.driverError = {
      code: '23505',
      detail: 'Key (slug)=(hello) already exists.',
    };
    const { body, statusCode } = runFilter(e);
    expect(statusCode).toBe(422);
    expect(body['code']).toBe(ErrorKey.DB_DUPLICATE_ENTRY);
    expect(JSON.stringify(body)).not.toContain('hello');
    expect(JSON.stringify(body)).not.toContain('already exists');
  });

  it('maps unknown Error to INTERNAL_ERROR', () => {
    const { body, statusCode } = runFilter(new Error('boom'));
    expect(statusCode).toBe(500);
    expect(body['code']).toBe(ErrorKey.INTERNAL_ERROR);
  });

  it('strips details unless debug is enabled', () => {
    const ex = keyed(404, ErrorKey.CRUD_RESOURCE_NOT_FOUND, undefined, {
      retryAfter: 5,
    });
    const hidden = runFilter(ex, { debug: false });
    expect(hidden.body['details']).toBeNull();

    const shown = runFilter(ex, { debug: true });
    expect(shown.body['details']).toEqual({ retryAfter: 5 });
  });
});
