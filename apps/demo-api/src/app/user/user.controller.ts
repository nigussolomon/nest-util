import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiExtraModels, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import {
  CreateNestedCrudController,
  EntityName,
  IBaseController,
} from '@nest-util/nest-crud';
import { JwtAuthGuard } from '@nest-util/nest-auth';

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
}
