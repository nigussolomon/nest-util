import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateNestedCrudController,
  EntityName,
  FilterDto,
  IBaseController,
  PaginationDto,
} from '@nest-util/nest-crud';
import {
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '@nest-util/nest-auth';
import { PermissionService } from './permission.service';
import {
  CreatePermissionDto,
  PermissionResponseDto,
  UpdatePermissionDto,
} from './permission.dto';

const PermissionCrudControllerBase = CreateNestedCrudController(
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionResponseDto
) as abstract new (service: PermissionService) => IBaseController<
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionResponseDto
>;

@ApiTags('Permissions')
@ApiExtraModels(CreatePermissionDto, UpdatePermissionDto, PermissionResponseDto)
@Controller('permissions')
@EntityName({ singular: 'Permission', plural: 'Permissions' })
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionController extends PermissionCrudControllerBase {
  constructor(override readonly service: PermissionService) {
    super(service);
  }

  @Get()
  @RequirePermissions('permissions:read')
  @ApiOperation({
    summary:
      'Fetch permissions (searchable and filterable, e.g. filter[resource_eq]=posts or filter[key_cont]=read)',
  })
  @ApiQuery({
    name: 'filter[resource_eq]',
    required: false,
    description: 'Filter permissions by exact resource value',
  })
  @ApiQuery({
    name: 'filter[key_cont]',
    required: false,
    description: 'Search permissions by key',
  })
  override findAll(@Query() query: PaginationDto & FilterDto) {
    return super.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('permissions:read')
  override findOne(@Param('id', ParseIntPipe) id: number) {
    return super.findOne(id);
  }

  @Post()
  @RequirePermissions('permissions:write')
  override create(@Body() dto: CreatePermissionDto) {
    return super.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('permissions:write')
  override update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionDto
  ) {
    return super.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('permissions:write')
  override remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
