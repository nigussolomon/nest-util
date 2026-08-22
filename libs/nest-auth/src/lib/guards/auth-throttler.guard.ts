import { keyed, ErrorKey } from '@nest-util/nest-error';
import { HttpStatus, Inject } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, InjectThrottlerOptions, InjectThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';

/**
 * IP-based rate limiter applied to sensitive auth endpoints. Blocks requests
 * with a generic 401 (same as invalid credentials) so clients cannot tell
 * whether the account exists or was throttled.
 */
export class AuthThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(AUTH_OPTIONS) private readonly authOptions: AuthModuleOptions
  ) {
    super(options, storageService, reflector);
  }

  protected override async getTracker(
    req: Record<string, unknown>
  ): Promise<string> {
    const keyGenerator = this.authOptions.rateLimit?.keyGenerator;
    if (keyGenerator) {
      return await keyGenerator(req);
    }
    const ips = Array.isArray(req.ips) ? req.ips : [];
    const ip =
      (ips[0] as string | undefined) ??
      (req.ip as string | undefined) ??
      (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress ??
      'unknown';
    return ip;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext
  ): Promise<void> {
    throw keyed(HttpStatus.UNAUTHORIZED, ErrorKey.AUTH_INVALID_CREDENTIALS);
  }
}
