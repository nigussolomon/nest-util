import { DynamicModule, Module, Global } from '@nestjs/common';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import type { AuditEvent, AuditEventModuleOptions } from './audit-event.interface';
import { AuditEventListener } from './audit-event.listener';

const AUDIT_EVENT_OPTIONS = 'AUDIT_EVENT_OPTIONS';
const AUDIT_EVENT_HANDLERS = 'AUDIT_EVENT_HANDLERS';

@Global()
@Module({})
export class AuditEventModule {
  static forRoot(options: AuditEventModuleOptions): DynamicModule {
    const listenerProvider = {
      provide: AuditEventListener,
      useFactory: (eventEmitter: EventEmitter2) => {
        const listener = new AuditEventListener();
        listener.configure(options.handlers, options);

        eventEmitter.onAny(async (...args: unknown[]) => {
          const event = args[1] as AuditEvent;
          if (event?.action) {
            await listener.handleEvent(event);
          }
        });

        return listener;
      },
      inject: [EventEmitter2],
    };

    return {
      module: AuditEventModule,
      imports: [EventEmitterModule.forRoot()],
      providers: [
        listenerProvider,
        { provide: AUDIT_EVENT_OPTIONS, useValue: options },
        { provide: AUDIT_EVENT_HANDLERS, useValue: options.handlers },
      ],
      exports: [EventEmitterModule],
    };
  }
}
