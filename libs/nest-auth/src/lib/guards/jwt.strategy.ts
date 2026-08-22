import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { AuthService } from '../services/auth.service';
import { AuthUser } from '../interfaces/user.interface';
import { keyed, ErrorKey } from '@nest-util/nest-error';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(AUTH_OPTIONS) options: AuthModuleOptions,
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: options.jwtSecret,
    });
  }

  async validate(payload: { sub: string | number; nonce: string }): Promise<AuthUser> {
    const user = await this.authService.validateUser(payload);
    if (!user) {
      throw keyed(HttpStatus.UNAUTHORIZED, ErrorKey.AUTH_UNAUTHORIZED);
    }
    return user;
  }
}
