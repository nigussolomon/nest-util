import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'nest_util_audit';

export interface AuditOptions {
  action: string;
  entity?: string;
}

export const Audit = (options: AuditOptions) =>
  SetMetadata(AUDIT_METADATA_KEY, options);
