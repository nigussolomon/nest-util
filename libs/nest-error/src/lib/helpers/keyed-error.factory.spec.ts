import { HttpException, HttpStatus } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { keyed, AppError } from './keyed-error.factory';
import { ErrorKey } from '../constants/error-keys';

describe('keyed() factory', () => {
  it('returns the real NestJS exception class (preserves instanceof)', () => {
    expect(keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND)).toBeInstanceOf(
      NotFoundException
    );
    expect(keyed(HttpStatus.BAD_REQUEST, ErrorKey.CRUD_INVALID_STATUS)).toBeInstanceOf(
      BadRequestException
    );
    expect(
      keyed(HttpStatus.FORBIDDEN, ErrorKey.CRUD_STATUS_TRANSITION_FORBIDDEN)
    ).toBeInstanceOf(ForbiddenException);
  });

  it('carries errorKey, params and details on the response object', () => {
    const ex = keyed(404, ErrorKey.CRUD_RELATION_NOT_FOUND, { field: 'author' }, {
      retryAfter: 5,
    });
    const res = ex.getResponse() as Record<string, unknown>;
    expect(res['errorKey']).toBe(ErrorKey.CRUD_RELATION_NOT_FOUND);
    expect(res['params']).toEqual({ field: 'author' });
    expect(res['details']).toEqual({ retryAfter: 5 });
  });

  it('falls back to a generic message when key unknown', () => {
    const ex = keyed(400, 'TOTALLY_UNKNOWN_KEY');
    expect((ex.getResponse() as Record<string, unknown>).message).toBe(
      'An unexpected error occurred'
    );
  });
});

describe('AppError', () => {
  it('is an HttpException carrying errorKey', () => {
    const ex = new AppError(422, ErrorKey.DB_DUPLICATE_ENTRY, { field: 'slug' });
    expect(ex).toBeInstanceOf(HttpException);
    expect(ex.errorKey).toBe(ErrorKey.DB_DUPLICATE_ENTRY);
    expect(ex.getStatus()).toBe(422);
  });
});
