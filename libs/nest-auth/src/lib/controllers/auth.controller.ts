import {
  Controller,
  Post,
  Body,
  Inject,
  ForbiddenException,
  UseGuards,
  Get,
  Type,
  Param,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user';
import { AuthUser, AuthTokens } from '../interfaces/user.interface';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { RolePermissionsDto } from '../dtos/role-permissions.dto';
import { Permissions } from '../decorators/permissions';
import { PermissionsGuard } from '../guards/permissions.guard';
import { resolvePermissionRegistry } from '../helpers/permission-registry.helper';

const ADMIN_ROUTE_PERMISSION = 'admin.access';

export function CreateAuthController(
  options: AuthModuleOptions
): Type<unknown> {
  const loginDto =
    options.loginDto ||
    class LoginDto {
      [key: string]: unknown;
    };
  const registerDto =
    options.registerDto ||
    class RegisterDto {
      [key: string]: unknown;
    };
  const refreshDto =
    options.refreshDto ||
    class RefreshDto {
      [key: string]: unknown;
    };

  @ApiTags('Authentication')
  @Controller('auth')
  class AuthController {
    constructor(
      protected readonly authService: AuthService,
      @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions
    ) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiBody({ type: registerDto })
    @ApiResponse({ status: 201, description: 'User successfully registered' })
    @ApiResponse({ status: 403, description: 'Registration is disabled' })
    async register(@Body() data: Record<string, unknown>): Promise<AuthUser> {
      this.checkIfRouteDisabled('register');
      return await this.authService.register(data);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login user and get tokens' })
    @ApiBody({ type: loginDto })
    @ApiResponse({ status: 200, description: 'User successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(
      @Body() credentials: Record<string, unknown>
    ): Promise<AuthTokens> {
      this.checkIfRouteDisabled('login');
      return await this.authService.login(credentials);
    }

    @Post('refresh')
    @ApiOperation({ summary: 'Refresh access token using refresh token' })
    @ApiBody({
      type: refreshDto,
      required: false,
      description: 'Support token in body for backward compatibility',
    })
    @ApiResponse({ status: 200, description: 'Tokens successfully refreshed' })
    @ApiResponse({
      status: 401,
      description: 'Invalid or expired refresh token',
    })
    async refresh(@Body() body: Record<string, unknown>): Promise<AuthTokens> {
      const refreshToken = body.refreshToken;

      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new ForbiddenException('Refresh token is required');
      }

      return await this.authService.refresh(refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Return current user' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
      return user;
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout user' })
    @ApiResponse({ status: 200, description: 'User successfully logged out' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async logout(@CurrentUser() user: AuthUser): Promise<boolean> {
      return await this.authService.logout(user.id);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Get('permissions')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Fetch registered permission catalog' })
    @ApiResponse({
      status: 200,
      description: 'Permission catalog successfully fetched',
    })
    getRegisteredPermissions() {
      return resolvePermissionRegistry(this.options.permissionRegistry);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Post('roles')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a role' })
    @ApiBody({ type: CreateRoleDto })
    @ApiResponse({ status: 201, description: 'Role successfully created' })
    @ApiResponse({ status: 400, description: 'Invalid role payload' })
    @ApiResponse({ status: 409, description: 'Role already exists' })
    async createRole(@Body() data: CreateRoleDto) {
      return await this.authService.createRole(data);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Get('roles')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Fetch all roles' })
    @ApiResponse({ status: 200, description: 'Roles successfully fetched' })
    async getAllRoles() {
      return await this.authService.getAllRoles();
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Post('users/:userId/roles/:roleId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Assign a role to a user' })
    @ApiResponse({
      status: 201,
      description: 'Role successfully assigned to user',
    })
    @ApiResponse({ status: 404, description: 'User or role not found' })
    async assignRoleToUser(
      @Param('userId', ParseIntPipe) userId: number,
      @Param('roleId', ParseIntPipe) roleId: number
    ) {
      return await this.authService.assignRoleToUser(userId, roleId);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Post('roles/:roleId/permissions')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Assign permissions to a role' })
    @ApiBody({ type: RolePermissionsDto })
    @ApiResponse({
      status: 200,
      description: 'Permissions successfully assigned to role',
    })
    @ApiResponse({ status: 400, description: 'Permissions payload is invalid' })
    @ApiResponse({ status: 404, description: 'Role not found' })
    async assignPermissionsToRole(
      @Param('roleId', ParseIntPipe) roleId: number,
      @Body() body: RolePermissionsDto
    ) {
      return await this.authService.assignPermissionsToRole(
        roleId,
        body.permissions
      );
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Delete('roles/:roleId/permissions')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove permissions from a role' })
    @ApiBody({ type: RolePermissionsDto })
    @ApiResponse({
      status: 200,
      description: 'Permissions successfully removed from role',
    })
    @ApiResponse({ status: 400, description: 'Permissions payload is invalid' })
    @ApiResponse({ status: 404, description: 'Role not found' })
    async removePermissionsFromRole(
      @Param('roleId', ParseIntPipe) roleId: number,
      @Body() body: RolePermissionsDto
    ) {
      return await this.authService.removePermissionsFromRole(
        roleId,
        body.permissions
      );
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Delete('users/:userId/roles/:roleId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove a role from a user' })
    @ApiResponse({
      status: 200,
      description: 'Role successfully removed from user',
    })
    @ApiResponse({ status: 404, description: 'User or role not found' })
    async removeRoleFromUser(
      @Param('userId', ParseIntPipe) userId: number,
      @Param('roleId', ParseIntPipe) roleId: number
    ) {
      return await this.authService.removeRoleFromUser(userId, roleId);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Get('users/:userId/roles')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Fetch roles assigned to a user' })
    @ApiResponse({
      status: 200,
      description: 'User roles successfully fetched',
    })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getUserRoles(@Param('userId', ParseIntPipe) userId: number) {
      return await this.authService.getUserRoles(userId);
    }

    protected checkIfRouteDisabled(routeName: string) {
      if (this.options.disabledRoutes?.includes(routeName)) {
        throw new ForbiddenException(`Route /auth/${routeName} is disabled`);
      }
    }
  }

  return AuthController;
}
