import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

interface DatabaseError extends Error {
  code?: string;
  errno?: number;
  detail?: string;
}

import { Response } from 'express';

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const driverError = exception.driverError as DatabaseError;

    const isUniqueViolation =
      driverError.code === '23505' || driverError.errno === 1062;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (isUniqueViolation) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;

      message = 'Duplicate entry: A record with this value already exists.';

      if (driverError.detail) {
        message = driverError.detail
          .replace('Key ', '')
          .replace(/[()]/g, '')
          .trim();
      }
    }

    response.status(status).json({
      status: 'error',
      message: message,
      statusCode: status,
    });
  }
}
