import {
  Controller,
  Inject,
  Get,
  Type,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user';
import { AuthUser } from '../interfaces/user.interface';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../decorators/permissions';
import { resolvePermissionRegistry } from '../helpers/permission-registry.helper';
import { resolvePermissions } from '../helpers/permission.helper';

const ADMIN_ROUTE_PERMISSION = 'admin.access';

export function CreatePermissionsController(
  options: AuthModuleOptions
): Type<unknown> {
  @ApiTags('Permissions')
  @Controller('auth')
  class PermissionsController {
    constructor(
      @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions
    ) {}

    @UseGuards(JwtAuthGuard)
    @Get('me/permissions')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user effective permissions' })
    @ApiResponse({
      status: 200,
      description: 'Return current user permissions',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getMyPermissions(@CurrentUser() user: AuthUser): string[] {
      return resolvePermissions(user, this.options.rbac);
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
  }

  return PermissionsController;
}
