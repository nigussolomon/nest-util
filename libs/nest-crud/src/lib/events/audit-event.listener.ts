import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { AuditEvent, AuditEventHandler, AuditEventModuleOptions } from './audit-event.interface';

function matchesGlob(pattern: string, value: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*').replace(/\*\*/g, '.*') + '$'
  );
  return regex.test(value);
}

function shouldDispatch(event: AuditEvent, options: AuditEventModuleOptions): boolean {
  const { include = ['*'], exclude = [] } = options;
  const action = event.action;
  const included = include.some((pattern) => matchesGlob(pattern, action));
  if (!included) return false;
  const excluded = exclude.some((pattern) => matchesGlob(pattern, action));
  return !excluded;
}

@Injectable()
export class AuditEventListener {
  private handlers: AuditEventHandler[] = [];
  private options: AuditEventModuleOptions = { handlers: [] };

  configure(handlers: AuditEventHandler[], options: AuditEventModuleOptions): void {
    this.handlers = handlers;
    this.options = options;
  }

  @OnEvent('*')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handleEvent(event: any): Promise<void> {
    const auditEvent = event as AuditEvent;
    if (!shouldDispatch(auditEvent, this.options)) return;

    const results = this.handlers.map(async (handler) => {
      try {
        await handler.handle(auditEvent);
      } catch (err) {
        console.error(
          `[AuditEvent] Handler ${handler.constructor.name} failed for "${auditEvent.action}":`,
          err,
        );
      }
    });

    await Promise.allSettled(results);
  }
}
