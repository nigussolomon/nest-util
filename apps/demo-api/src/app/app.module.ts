import { Module } from '@nestjs/common';
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
import { LoginDto, RegisterDto, RefreshDto } from './auth/auth.dto';
import { NestUtilNestAuditModule, AuditInterceptor } from '@nest-util/nest-audit';
import { FileModule } from './file/file.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { Role } from './role/role.entity';
import { Permission } from './permission/permission.entity';

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
    TypeOrmModule.forFeature([Post, Comment, Role, Permission]),
    UserModule,
    RoleModule,
    PermissionModule,

    NestUtilNestAuditModule,
    FileModule,
    AuthModule.forRoot({
      userEntity: User,
      identifierField: 'email',
      passkeyField: 'password',
      jwtSecret: 'super-secret-key',
      refreshTokenSecret: 'super-secret-key',
      refreshTokenExpiresIn: '7d',
      refreshTokenField: 'refreshToken',
      disabledRoutes: ['register'],
      accessTokenField: 'accessToken',
      loginDto: LoginDto,
      registerDto: RegisterDto,
      refreshDto: RefreshDto,
      relations: ['roles', 'roles.permissions'],
      rbac: {
        enabled: true,
        rolesField: 'roles',
        roleNameField: 'name',
        rolePermissionsField: 'permissions',
        permissionNameField: 'key',
        denyByDefault: true,
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
