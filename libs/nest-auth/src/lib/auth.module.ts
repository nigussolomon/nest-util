import { DynamicModule, Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_OPTIONS } from './constants';
import { AuthModuleOptions } from './interfaces/auth-options';
import { AuthService } from './services/auth.service';
import { RouteDisabledGuard } from './guards/route-disabled.guard';
import { CreateAuthController } from './controllers/auth.controller';
import { JwtStrategy } from './guards/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Global()
@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    const Controller = CreateAuthController(options);

    return {
      module: AuthModule,
      controllers: [Controller],
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: options.jwtSecret,
          signOptions: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expiresIn: (options.expiresIn ?? '1h') as any,
          },
        }),
        TypeOrmModule.forFeature([options.userEntity]),
      ],
      providers: [
        {
          provide: AUTH_OPTIONS,
          useValue: options,
        },
        AuthService,
        RouteDisabledGuard,
        JwtStrategy,
        JwtAuthGuard,
      ],
      exports: [
        AUTH_OPTIONS,
        JwtModule,
        PassportModule,
        TypeOrmModule,
        AuthService,
        RouteDisabledGuard,
        JwtStrategy,
        JwtAuthGuard,
      ],
    };
  }
}
