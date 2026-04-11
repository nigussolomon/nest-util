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
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
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
import { RoleService } from './role.service';
import { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from './role.dto';

const RoleCrudControllerBase = CreateNestedCrudController(
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto
) as abstract new (service: RoleService) => IBaseController<
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto
>;

@ApiTags('Roles')
@ApiExtraModels(CreateRoleDto, UpdateRoleDto, RoleResponseDto)
@Controller('roles')
@EntityName({ singular: 'Role', plural: 'Roles' })
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoleController extends RoleCrudControllerBase {
  constructor(override readonly service: RoleService) {
    super(service);
  }

  @Get()
  @RequirePermissions('roles:read')
  override findAll(@Query() query: PaginationDto & FilterDto) {
    return super.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('roles:read')
  override findOne(@Param('id', ParseIntPipe) id: number) {
    return super.findOne(id);
  }

  @Post()
  @RequirePermissions('roles:write')
  override create(@Body() dto: CreateRoleDto) {
    return super.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('roles:write')
  override update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return super.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('roles:write')
  override remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
