import {
  Controller,
  Inject,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
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
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user';
import { AuthUser } from '../interfaces/user.interface';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../decorators/permissions';
import { CreateApiKeyDto } from '../dtos/create-api-key.dto';
import { ApiKeyService } from '../services/api-key.service';

const ADMIN_ROUTE_PERMISSION = 'admin.access';

export function CreateApiKeysController(
  options: AuthModuleOptions
): Type<unknown> {
  @ApiTags('API Keys')
  @Controller('auth')
  class ApiKeysController {
    constructor(
      @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions,
      protected readonly apiKeyService?: ApiKeyService
    ) {}

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Post('api-keys')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new API key' })
    @ApiBody({ type: CreateApiKeyDto })
    @ApiResponse({ status: 201, description: 'API key created (raw key returned once)' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    async createApiKey(
      @CurrentUser() user: AuthUser,
      @Body() data: CreateApiKeyDto
    ) {
      return await this.apiKeyService!.create(user.id as number, data);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Get('api-keys')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List all API keys for the current user' })
    @ApiResponse({ status: 200, description: 'API keys listed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async listApiKeys(@CurrentUser() user: AuthUser) {
      return await this.apiKeyService!.list(user.id as number);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Delete('api-keys/:id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revoke an API key' })
    @ApiResponse({ status: 200, description: 'API key revoked' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Key not found' })
    async revokeApiKey(
      @CurrentUser() user: AuthUser,
      @Param('id', ParseUUIDPipe) id: string
    ) {
      return await this.apiKeyService!.revoke(user.id as number, id);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Post('api-keys/:id/roles/:roleId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Assign a role to an API key' })
    @ApiResponse({ status: 201, description: 'Role assigned to API key' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Key or role not found' })
    @ApiResponse({ status: 409, description: 'Role already assigned' })
    async assignRoleToApiKey(
      @CurrentUser() user: AuthUser,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('roleId', ParseIntPipe) roleId: number
    ) {
      return await this.apiKeyService!.assignRole(user.id as number, id, roleId);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions(ADMIN_ROUTE_PERMISSION)
    @Delete('api-keys/:id/roles/:roleId')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove a role from an API key' })
    @ApiResponse({ status: 200, description: 'Role removed from API key' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Key or role not found' })
    async removeRoleFromApiKey(
      @CurrentUser() user: AuthUser,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('roleId', ParseIntPipe) roleId: number
    ) {
      return await this.apiKeyService!.removeRole(user.id as number, id, roleId);
    }
  }

  return ApiKeysController;
}
