import type { AuditEvent, AuditEventHandler, AuditEventModuleOptions } from './audit-event.interface';

const RE_SPECIAL = /[.+?^${}()|[\]\\]/g;

function matchesGlob(pattern: string, value: string): boolean {
  let regexStr = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (i + 1 < pattern.length && pattern[i + 1] === '*') {
        regexStr += '.*';
        i++;
      } else {
        regexStr += '[^.]*';
      }
    } else {
      regexStr += ch.replace(RE_SPECIAL, '\\$&');
    }
  }
  regexStr += '$';
  return new RegExp(regexStr).test(value);
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
