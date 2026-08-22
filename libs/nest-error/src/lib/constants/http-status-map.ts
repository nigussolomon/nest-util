import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

type HttpExceptionConstructor = new (
  response?: string | Record<string, unknown>
) => HttpException;

/**
 * Maps an HTTP status code to the matching NestJS exception class so that
 * `keyed()` returns the *real* NestJS exception instance (preserving `instanceof`
 * assertions in existing specs).
 */
const STATUS_TO_EXCEPTION: Record<number, HttpExceptionConstructor> = {
  [HttpStatus.BAD_REQUEST]: BadRequestException,
  [HttpStatus.UNAUTHORIZED]: UnauthorizedException,
  [HttpStatus.FORBIDDEN]: ForbiddenException,
  [HttpStatus.NOT_FOUND]: NotFoundException,
  [HttpStatus.CONFLICT]: ConflictException,
  [HttpStatus.UNPROCESSABLE_ENTITY]: UnprocessableEntityException,
  [HttpStatus.INTERNAL_SERVER_ERROR]: InternalServerErrorException,
};

export function pickNestClass(status: number): HttpExceptionConstructor {
  return (
    STATUS_TO_EXCEPTION[status] ?? InternalServerErrorException
  );
}
