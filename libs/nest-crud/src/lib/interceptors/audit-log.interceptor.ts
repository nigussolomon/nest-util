import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../services/audit-log.service';
import {
  AUDIT_METADATA_KEY,
  AuditOptions,
} from '../decorators/audit-log.decorator';
import type { AuditEvent } from '../events/audit-event.interface';

const CONTROLLER_ENTITY_NAME_KEY = 'entityName';
const ENTITY_ENTITY_NAME_KEY = 'custom:entityName';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
    @Optional() private readonly eventEmitter?: EventEmitter2
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>
  ): Observable<unknown> {
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
    const entityIdFromParams = request.params?.id;

    let entityName = auditOptions.entity;

    if (!entityName) {
      entityName = this.resolveEntityName(context);
    }

    const basePayload = {
      entity: entityName,
      userId,
      ip,
      userAgent,
    };

    return next.handle().pipe(
      tap(async (result) => {
        const entityId = (result as any)?.id ?? entityIdFromParams;

        await this.auditService.log({
          action: auditOptions.action,
          entity: entityName,
          entityId,
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

        this.emitEvent({
          ...basePayload,
          action: `crud.${entityName.toLowerCase()}.${auditOptions.action.toLowerCase()}.success`,
          entityId,
          timestamp: new Date(),
          metadata: {
            body: request.body,
            params: request.params,
            query: request.query,
          },
        });
      }),
      catchError((error) => {
        const entityId = entityIdFromParams;

        this.emitEvent({
          ...basePayload,
          action: `crud.${entityName.toLowerCase()}.${auditOptions.action.toLowerCase()}.error`,
          entityId,
          timestamp: new Date(),
          metadata: {
            body: request.body,
            params: request.params,
            query: request.query,
            error: { message: error.message, statusCode: error.status },
          },
        });

        return throwError(() => error);
      })
    );
  }

  private emitEvent(event: AuditEvent): void {
    if (!this.eventEmitter) return;
    this.eventEmitter.emit(event.action, event);
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
