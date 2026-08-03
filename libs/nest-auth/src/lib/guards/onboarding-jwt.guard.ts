import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { OnboardingAttemptEntity } from '../entities/onboarding-attempt.entity';

export interface OnboardingTokenPayload {
  sub: number;
  type: 'onboarding';
  identifierField: string;
  identifier: string;
  [key: string]: unknown;
}

@Injectable()
export class OnboardingJwtGuard implements CanActivate {
  private readonly onboardingAttemptRepository: Repository<OnboardingAttemptEntity>;

  constructor(
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
    private readonly jwtService: JwtService,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Optional() @Inject(EventEmitter2) private readonly eventEmitter?: EventEmitter2
  ) {
    this.onboardingAttemptRepository =
      this.dataSource.getRepository(OnboardingAttemptEntity);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options.onboarding?.enabled) {
      throw new UnauthorizedException('Onboarding is not enabled');
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request);

    if (!token) {
      this.emitDenied(request, 'Missing onboarding token');
      throw new UnauthorizedException('Onboarding token is required');
    }

    const secret = this.options.onboarding.onboardingTokenSecret ||
      this.options.jwtSecret;

    let payload: OnboardingTokenPayload;
    try {
      payload = this.jwtService.verify<OnboardingTokenPayload>(token, {
        secret,
      });
    } catch {
      this.emitDenied(request, 'Invalid or expired onboarding token');
      throw new UnauthorizedException('Invalid or expired onboarding token');
    }

    if (payload.type !== 'onboarding' || !payload.sub) {
      this.emitDenied(request, 'Token is not an onboarding token');
      throw new UnauthorizedException('Invalid onboarding token');
    }

    const attempt = await this.onboardingAttemptRepository.findOne({
      where: { id: payload.sub } as never,
    });

    if (!attempt) {
      this.emitDenied(request, 'Onboarding attempt not found');
      throw new UnauthorizedException('Invalid onboarding token');
    }

    if (attempt.consumedAt) {
      this.emitDenied(request, 'Onboarding token already used');
      throw new UnauthorizedException('Onboarding token has already been used');
    }

    request.onboardingAttempt = attempt;
    request.onboardingPayload = payload;

    return true;
  }

  private extractBearerToken(request: {
    headers?: Record<string, unknown>;
  }): string | null {
    const header = request.headers?.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }

  private emitDenied(
    request: { onboardingPayload?: OnboardingTokenPayload },
    reason: string
  ): void {
    if (!this.eventEmitter) return;
    this.eventEmitter.emit('auth.onboarding.denied', {
      action: 'auth.onboarding.denied',
      entity: 'auth',
      timestamp: new Date(),
      metadata: { reason, attemptId: request.onboardingPayload?.sub },
    });
  }
}
