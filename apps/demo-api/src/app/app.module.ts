import { Module, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from '@nest-util/nest-crud';
import { PostController } from './post/post.controller';
import { CommentController } from './comment/comment.controller';
import { PostService } from './post/post.service';
import { CommentService } from './comment/comment.service';
import { Comment } from './comment/comment.entity';
import { Post } from './post/post.entity';
import { AuthModule } from '@nest-util/nest-auth';
import { User } from './user/user.entity';
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  OtpRequestDto,
  OtpLoginDto,
  PasswordResetDto,
  PasswordResetRequestDto,
} from './auth/auth.dto';
import { permissionRegistry } from './auth/permission-registry';
import {
  AuditInterceptor,
  NestCrudModule,
} from '@nest-util/nest-crud';
import { NestFileModule } from '@nest-util/nest-file';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Post, Comment]),
    UserModule,
    NestCrudModule,
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'super-secret-key',
      refreshTokenSecret: 'super-secret-key',
      refreshTokenExpiresIn: '7d',
      refreshTokenField: 'refreshToken',
      disabledRoutes: [''],
      accessTokenField: 'accessToken',
      apiKey: { enabled: true },
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      otp: {
        enabled: true,
        requestDto: OtpRequestDto,
        loginDto: OtpLoginDto,
        ttlSeconds: 300,
        cooldownSeconds: 60,
        maxAttempts: 5,
        lockSeconds: 300,
        channel: 'sms',
        codeField: 'otpCodeHash',
        expiresAtField: 'otpCodeExpiresAt',
        attemptsField: 'otpRequestAttempts',
        lastSentAtField: 'otpLastSentAt',
        lockUntilField: 'otpLockedUntil',
        deliverCode: async ({ identifier, code, channel }) => {
          // Demo transport hook. Production apps should send via SMTP/SMS provider.
          Logger.log(
            `[demo-api OTP] channel=${channel} identifier=${identifier} code=${code}`,
            'DemoAuthModule'
          );
        },
      },
      passwordReset: {
        enabled: true,

        requestDto: PasswordResetRequestDto,
        resetDto: PasswordResetDto,

        tokenLength: 64,
        tokenTtlSeconds: 3600,

        tokenField: 'passwordResetTokenHash',
        expiresAtField: 'passwordResetTokenExpiresAt',

        deliverToken: async ({ identifier, token, expiresAt }) => {
          Logger.log(
            `[demo-api PASSWORD RESET] identifier=${identifier} token=${token} expiresAt=${expiresAt.toISOString()}`,
            'DemoAuthModule'
          );
        },
      },
      relations: ['userRoles', 'userRoles.role'],
      rbac: {
        userRolesRelation: 'userRoles',
        rolesKey: 'userRoles',
        nestedRoleKey: 'role',
      },
      permissionRegistry,
    }),
    PaymentModule,
    NestFileModule.forRoot({
      s3: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'us-east-1',
        bucket: process.env.S3_BUCKET ?? 'demo-bucket',
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        publicUrl: process.env.S3_PUBLIC_URL,
      },
      controller: {
        path: 'files',
        permissions: {
          upload: 'files.create',
          download: 'files.read',
          list: 'files.read',
          remove: 'files.delete',
        },
      },
    }),
  ],
  controllers: [AppController, PostController, CommentController],
  providers: [
    AppService,
    PostService,
    CommentService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
