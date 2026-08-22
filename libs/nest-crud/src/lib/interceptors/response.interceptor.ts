import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  MESSAGE_KEY,
  ENTITY_NAME_KEY,
  EntityNames,
} from '../decorators/response-message.decorator';
import {
  I18nService,
  LangResolverService,
  ErrorKey,
} from '@nest-util/nest-error';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly i18n?: I18nService,
    @Optional() private readonly langResolver?: LangResolverService
  ) {}

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

        const finalMessage = this.localize(name, action, context);

        return {
          message: finalMessage,
          data: data?.data ?? data ?? null,
          meta: data?.meta,
          status: 'success',
        };
      })
    );
  }

  private localize(
    name: string,
    action: string | undefined,
    context: ExecutionContext
  ): string {
    if (!this.i18n || !this.langResolver) {
      return action ? `${name} ${action} successfully` : 'Request successful';
    }

    const request = context.switchToHttp().getRequest<Request>();
    const lang = this.langResolver.resolve(
      (request as Request) ?? ({ headers: {} } as Request)
    );

    const localizedAction = action
      ? this.i18n.translate(action, {}, lang)
      : this.i18n.translate(ErrorKey.MSG_REQUEST_SUCCESS, {}, lang);

    return this.i18n.translate(
      ErrorKey.SUCCESS_FORMAT,
      { entity: name, action: localizedAction },
      lang
    );
  }
}
