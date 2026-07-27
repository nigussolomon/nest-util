export interface AuditEvent {
  /** Dot-separated event name, e.g. 'auth.user.login.success' */
  action: string;
  /** Entity type: 'user', 'role', 'post', etc. */
  entity: string;
  /** ID of the affected entity (optional for list/search events) */
  entityId?: string | number;
  /** ID of the user performing the action */
  userId?: string | number;
  /** Client IP address */
  ip?: string;
  /** User-Agent header */
  userAgent?: string;
  /** Multi-tenant ID */
  tenantId?: string;
  /** Event timestamp */
  timestamp: Date;
  /** Arbitrary event-specific data */
  metadata?: Record<string, unknown>;
}

export interface AuditEventHandler {
  handle(event: AuditEvent): void | Promise<void>;
}

export interface AuditEventModuleOptions {
  /** Handlers to dispatch events to */
  handlers: AuditEventHandler[];
  /** Glob patterns to include (default: ['*']) */
  include?: string[];
  /** Glob patterns to exclude (default: []) */
  exclude?: string[];
}
