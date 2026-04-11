import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiExtraModels, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import {
  CreateNestedCrudController,
  EntityName,
  IBaseController,
} from '@nest-util/nest-crud';
import {
  AllowRoles,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '@nest-util/nest-auth';
import { FilterDto } from '@nest-util/nest-crud';
import { PaginationDto } from '@nest-util/nest-crud';

const UsersCrudControllerBase = CreateNestedCrudController(
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
) as abstract new (service: UsersService) => IBaseController<
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
>;

@ApiTags('Users')
@ApiExtraModels(CreateUserDto, UpdateUserDto, UserResponseDto)
@Controller('users')
@EntityName({ singular: 'User', plural: 'Users' })
@AllowRoles('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersController extends UsersCrudControllerBase {
  constructor(override readonly service: UsersService) {
    super(service);
  }

  @Get()
  @RequirePermissions('users:read')
  override findAll(@Query() query: PaginationDto & FilterDto) {
    return super.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  override findOne(@Param('id', ParseIntPipe) id: number) {
    return super.findOne(id);
  }

  @Post()
  @RequirePermissions('users:write')
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  override update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return super.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:write')
  override remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
