import {
  Controller,
  Inject,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Type,
  UseGuards,
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
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../decorators/permissions';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { RolePermissionsDto } from '../dtos/role-permissions.dto';

const ADMIN_ROUTE_PERMISSION = 'admin.access';

export function CreateRolesController(
  options: AuthModuleOptions
): Type<unknown> {
  @ApiTags('Roles')
  @Controller('auth')
  class RolesController {
    constructor(
      protected readonly authService: AuthService,
      @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions
    ) {}

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
  }

  return RolesController;
}
