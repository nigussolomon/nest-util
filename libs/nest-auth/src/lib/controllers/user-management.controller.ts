import {
  Controller,
  Inject,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Type,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../decorators/permissions';

interface ListUsersQuery {
  page?: string;
  limit?: string;
  q?: string;
  active?: string;
}

function toPositiveInt(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? undefined : parsed;
}

export function CreateUserManagementController(
  options: AuthModuleOptions
): Type<unknown> {
  const permission = options.userManagement?.permission ?? 'admin.access';

  @ApiTags('User Management')
  @Controller('auth')
  class UserManagementController {
    constructor(
      protected readonly authService: AuthService,
      @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions
    ) {}

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(permission)
    @Get('users')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List users (paginated)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'q', required: false, type: String })
    @ApiQuery({ name: 'active', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'Paginated user list' })
    async listUsers(@Query() query: ListUsersQuery) {
      return await this.authService.listUsers({
        page: toPositiveInt(query.page),
        limit: toPositiveInt(query.limit),
        q: query.q,
        active:
          query.active === 'true'
            ? true
            : query.active === 'false'
              ? false
              : undefined,
      });
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(permission)
    @Get('users/:id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a single user' })
    @ApiResponse({ status: 200, description: 'The requested user' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getUserById(@Param('id', ParseIntPipe) id: number) {
      return await this.authService.getUserById(id);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(permission)
    @Post('users')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a user' })
    @ApiBody({ schema: { type: 'object' } })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    @ApiResponse({ status: 400, description: 'Invalid user payload' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    async createUser(@Body() data: Record<string, unknown>) {
      return await this.authService.createUserByAdmin(data);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(permission)
    @Patch('users/:id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a user' })
    @ApiBody({ schema: { type: 'object' } })
    @ApiResponse({ status: 200, description: 'User successfully updated' })
    @ApiResponse({ status: 400, description: 'Invalid user payload' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async updateUser(
      @Param('id', ParseIntPipe) id: number,
      @Body() data: Record<string, unknown>
    ) {
      return await this.authService.updateUser(id, data);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(permission)
    @Post('users/:id/activate')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Activate a user' })
    @ApiResponse({ status: 200, description: 'User successfully activated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async activateUser(@Param('id', ParseIntPipe) id: number) {
      return await this.authService.setUserActive(id, true);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(permission)
    @Post('users/:id/deactivate')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiResponse({ status: 200, description: 'User successfully deactivated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async deactivateUser(@Param('id', ParseIntPipe) id: number) {
      return await this.authService.setUserActive(id, false);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(permission)
    @Delete('users/:id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a user' })
    @ApiResponse({ status: 200, description: 'User successfully deleted' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async deleteUser(@Param('id', ParseIntPipe) id: number) {
      return await this.authService.deleteUser(id);
    }
  }

  return UserManagementController;
}
