import { AuditEvent, AuditEventHandler } from '../audit-event.interface';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

function colorize(text: string, color: string): string {
  return `${color}${text}${COLORS.reset}`;
}

function formatEvent(event: AuditEvent): string {
  const ts = event.timestamp.toISOString();
  const isSuccess = event.action.endsWith('.success') || (!event.action.includes('.failed') && !event.action.includes('.error') && !event.action.includes('.denied') && !event.action.includes('.conflict') && !event.action.includes('.locked') && !event.action.includes('.disabled'));
  const statusColor = isSuccess ? COLORS.green : COLORS.red;
  const parts = [
    colorize(ts, COLORS.dim),
    colorize(event.action, statusColor),
    colorize(`entity=${event.entity}`, COLORS.cyan),
  ];

  if (event.entityId != null) {
    parts.push(colorize(`id=${event.entityId}`, COLORS.blue));
  }
  if (event.userId != null) {
    parts.push(colorize(`userId=${event.userId}`, COLORS.yellow));
  }
  if (event.ip) {
    parts.push(colorize(`ip=${event.ip}`, COLORS.gray));
  }

  return parts.join(' ');
}

export class ConsoleHandler implements AuditEventHandler {
  handle(event: AuditEvent): void {
    console.log(formatEvent(event));
  }
}
