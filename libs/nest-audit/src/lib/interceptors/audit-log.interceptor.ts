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
      try {
        const controllerInstance = context.getClass().prototype;
        const serviceInstance = controllerInstance?.service;
        const repositoryTarget = serviceInstance?.repository?.target;

        const meta = repositoryTarget
          ? Reflect.getMetadata('custom:entityName', repositoryTarget)
          : null;

        entityName = meta?.singular ?? 'Resource';
      } catch {
        entityName = 'Resource';
      }
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
}
