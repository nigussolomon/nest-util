import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import {
  MESSAGE_KEY,
  ENTITY_NAME_KEY,
  EntityNames,
} from '../decorators/response-message.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const controller = context.getClass();

    return next.handle().pipe(
      map((data) => {
        const entityConfig = this.reflector.get<EntityNames>(
          ENTITY_NAME_KEY,
          controller
        );

        const action = this.reflector.get<string>(MESSAGE_KEY, handler);
        const isList = Array.isArray(data) || Array.isArray(data?.data);

        const name = isList
          ? entityConfig?.plural ?? 'Resources'
          : entityConfig?.singular ?? 'Resource';

        const finalMessage = action
          ? `${name} ${action} successfully`
          : 'Request successful';

        return {
          message: finalMessage,
          data: data?.data ?? data ?? null,
          meta: data?.meta,
          status: 'success',
        };
      })
    );
  }
}
