import 'reflect-metadata';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AUDIT_METADATA_KEY } from '../decorators/audit-log.decorator';
import { AuditService } from '../services/audit-log.service';
import { AuditInterceptor } from './audit-log.interceptor';

describe('AuditInterceptor', () => {
  const log = jest.fn().mockResolvedValue(undefined);
  const auditService = { log } as unknown as AuditService;
  const reflector = new Reflector();

  beforeEach(() => {
    log.mockClear();
  });

  const callHandler: CallHandler = {
    handle: () => of({ ok: true }),
  };

  const buildContext = (controller: Function): ExecutionContext => {
    const handler = () => undefined;

    Reflect.defineMetadata(
      AUDIT_METADATA_KEY,
      {
        action: 'CREATE',
      },
      handler
    );

    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: '1' },
          ip: '127.0.0.1',
          headers: { 'user-agent': 'jest' },
          body: {},
          params: {},
          query: {},
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('uses @EntityName metadata from controller when no explicit audit entity is provided', async () => {
    class TestController {}
    Reflect.defineMetadata(
      'entityName',
      { singular: 'User', plural: 'Users' },
      TestController
    );

    const interceptor = new AuditInterceptor(auditService, reflector);
    const context = buildContext(TestController);

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, callHandler).subscribe({
        complete: resolve,
      });
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'User',
      })
    );
  });

  it('falls back to legacy entity metadata on repository target when controller metadata is missing', async () => {
    class UserEntity {}

    Reflect.defineMetadata(
      'custom:entityName',
      { singular: 'UserEntity', plural: 'UserEntities' },
      UserEntity
    );

    class TestController {}
    (TestController as any).prototype.service = {
      repository: { target: UserEntity },
    };

    const interceptor = new AuditInterceptor(auditService, reflector);
    const context = buildContext(TestController);

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, callHandler).subscribe({
        complete: resolve,
      });
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'UserEntity',
      })
    );
  });
});
