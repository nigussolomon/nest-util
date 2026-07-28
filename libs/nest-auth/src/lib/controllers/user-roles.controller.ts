import {
  Controller,
  Inject,
  Post,
  Get,
  Delete,
  Param,
  ParseIntPipe,
  Type,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../decorators/permissions';

const ADMIN_ROUTE_PERMISSION = 'admin.access';

export function CreateUserRolesController(
  options: AuthModuleOptions
): Type<unknown> {
  @ApiTags('User Roles')
  @Controller('auth')
  class UserRolesController {
    constructor(
      protected readonly authService: AuthService,
      @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions
    ) {}

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
  }

  return UserRolesController;
}
