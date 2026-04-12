import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiExtraModels,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import {
  CreateNestedCrudController,
  EntityName,
  IBaseController,
} from '@nest-util/nest-crud';
import {
  CurrentUser,
  JwtAuthGuard,
  Permissions,
  PermissionsGuard,
} from '@nest-util/nest-auth';
import { AssignRoleDto } from './assign-role.dto';
import { RoleResponseDto } from './role-response.dto';

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
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController extends UsersCrudControllerBase {
  constructor(override readonly service: UsersService) {
    super(service);
  }

  @Post(':id/roles')
  @ApiOkResponse({ type: RoleResponseDto })
  async assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto
  ) {
    return this.service.assignRole(id, dto);
  }

  @Get(':id/roles')
  @ApiOkResponse({ type: RoleResponseDto, isArray: true })
  async listRoles(@Param('id', ParseIntPipe) id: number) {
    return this.service.listRoles(id);
  }

  @Get('me/rbac-example')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage')
  @ApiOkResponse({ type: UserResponseDto })
  getRbacExample(@CurrentUser() user: UserResponseDto) {
    return user;
  }
}
