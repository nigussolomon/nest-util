import type { AuditEvent, AuditEventHandler, AuditEventModuleOptions } from './audit-event.interface';

function matchesGlob(pattern: string, value: string): boolean {
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '\x00')
        .replace(/\*/g, '[^.]*')
        .replace(/\x00/g, '.*') +
      '$'
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

export class AuditEventListener {
  private handlers: AuditEventHandler[] = [];
  private options: AuditEventModuleOptions = { handlers: [] };

  configure(handlers: AuditEventHandler[], options: AuditEventModuleOptions): void {
    this.handlers = handlers;
    this.options = options;
  }

  async handleEvent(event: AuditEvent): Promise<void> {
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
