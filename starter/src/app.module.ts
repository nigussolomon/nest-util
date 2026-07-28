import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  NestCrudModule,
  ResponseInterceptor,
  AuditInterceptor,
  AuditEventModule,
  ConsoleHandler,
} from '@nest-util/nest-crud';
import { AuthModule } from '@nest-util/nest-auth';
import { UserModule } from './user/user.module';
import { User } from './user/user.entity';
import { Role } from './user/role.entity';
import { UserRole } from './user/user-role.entity';
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  OtpRequestDto,
  OtpLoginDto,
  PasswordResetRequestDto,
  PasswordResetDto,
} from './auth/auth.dto';
import { permissionRegistry } from './auth/permission-registry';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'starter_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, Role, UserRole]),
    NestCrudModule,
    AuditEventModule.forRoot({
      handlers: [new ConsoleHandler()],
      include: ['auth.**', 'crud.**'],
    }),
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
      refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'change-me-in-production',
      refreshTokenExpiresIn: '7d',
      refreshTokenField: 'refreshToken',
      accessTokenField: 'accessToken',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      relations: ['userRoles', 'userRoles.role'],
      rbac: {
        userRolesRelation: 'userRoles',
        rolesKey: 'userRoles',
        nestedRoleKey: 'role',
      },
      permissionRegistry,
      otp: {
        enabled: true,
        requestDto: OtpRequestDto,
        loginDto: OtpLoginDto,
        ttlSeconds: 300,
        cooldownSeconds: 60,
        maxAttempts: 5,
        lockSeconds: 300,
        channel: 'email',
        deliverCode: async ({ identifier, code, channel }) => {
          Logger.log(
            `[OTP] channel=${channel} identifier=${identifier} code=${code}`,
            'AuthModule'
          );
        },
      },
      passwordReset: {
        enabled: true,
        requestDto: PasswordResetRequestDto,
        resetDto: PasswordResetDto,
        deliverToken: async ({ identifier, token, expiresAt }) => {
          Logger.log(
            `[PASSWORD RESET] identifier=${identifier} token=${token} expiresAt=${expiresAt.toISOString()}`,
            'AuthModule'
          );
        },
      },
    }),
    UserModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
