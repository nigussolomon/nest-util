import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../services/audit-log.service';
import {
  AUDIT_METADATA_KEY,
  AuditOptions,
} from '../decorators/audit-log.decorator';

const CONTROLLER_ENTITY_NAME_KEY = 'entityName';
const ENTITY_ENTITY_NAME_KEY = 'custom:entityName';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const auditOptions = this.reflector.get<AuditOptions>(
      AUDIT_METADATA_KEY,
      handler
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const ip = request.ip;
    const userAgent = request.headers?.['user-agent'];

    let entityName = auditOptions.entity;

    if (!entityName) {
      entityName = this.resolveEntityName(context);
    }

    return next.handle().pipe(
      tap(async (result) => {
        await this.auditService.log({
          action: auditOptions.action,
          entity: entityName, // dynamically resolved or default
          userId,
          ip,
          userAgent,
          metadata: {
            body: request.body,
            params: request.params,
            query: request.query,
            response: result,
          },
        });
      })
    );
  }

  private resolveEntityName(context: ExecutionContext): string {
    const controllerClass = context.getClass();
    const controllerMeta = Reflect.getMetadata(
      CONTROLLER_ENTITY_NAME_KEY,
      controllerClass
    );

    if (controllerMeta?.singular) {
      return controllerMeta.singular;
    }

    try {
      const controllerInstance = controllerClass.prototype;
      const serviceInstance = controllerInstance?.service;
      const repositoryTarget = serviceInstance?.repository?.target;
      const entityMeta = repositoryTarget
        ? Reflect.getMetadata(ENTITY_ENTITY_NAME_KEY, repositoryTarget)
        : null;

      return entityMeta?.singular ?? 'Resource';
    } catch {
      return 'Resource';
    }
  }
}
