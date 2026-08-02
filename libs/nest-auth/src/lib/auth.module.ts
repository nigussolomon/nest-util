import { DynamicModule, Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_OPTIONS } from './constants';
import { AuthModuleOptions } from './interfaces/auth-options';
import { AuthService } from './services/auth.service';
import { RouteDisabledGuard } from './guards/route-disabled.guard';
import { CreateAuthController } from './controllers/auth.controller';
import { CreatePermissionsController } from './controllers/permissions.controller';
import { CreateRolesController } from './controllers/roles.controller';
import { CreateUserRolesController } from './controllers/user-roles.controller';
import { CreateApiKeysController } from './controllers/api-keys.controller';
import { JwtStrategy } from './guards/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyService } from './services/api-key.service';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { ApiKeyEntity } from './entities/api-key.entity';
import { ApiKeyRoleEntity } from './entities/api-key-role.entity';
import { Reflector } from '@nestjs/core';

@Global()
@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    const apiKeyEnabled = options.apiKey?.enabled === true;
    const Controllers = [
      CreateAuthController(options),
      CreatePermissionsController(options),
      CreateRolesController(options),
      CreateUserRolesController(options),
      ...(apiKeyEnabled ? [CreateApiKeysController(options)] : []),
    ];
    const apiKeyEntities = apiKeyEnabled
      ? [ApiKeyEntity, ApiKeyRoleEntity]
      : [];
    const apiKeyProviders = apiKeyEnabled
      ? [ApiKeyService, ApiKeyGuard]
      : [];
    const apiKeyExports = apiKeyEnabled
      ? [ApiKeyService, ApiKeyGuard]
      : [];

    return {
      module: AuthModule,
      controllers: Controllers,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: options.jwtSecret,
          signOptions: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expiresIn: (options.expiresIn ?? '1h') as any,
          },
        }),
        TypeOrmModule.forFeature([
          options.userEntity,
          RoleEntity,
          UserRoleEntity,
          ...apiKeyEntities,
        ]),
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
        PermissionsGuard,
        Reflector,
        ...apiKeyProviders,
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
        PermissionsGuard,
        Reflector,
        ...apiKeyExports,
      ],
    };
  }
}
