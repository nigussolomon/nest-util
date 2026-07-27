import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateNestedCrudController,
  EntityName,
  IBaseController,
} from '@nest-util/nest-crud';
import { JwtAuthGuard } from '@nest-util/nest-auth';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';

const UserCrudControllerBase = CreateNestedCrudController(
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
) as abstract new (service: UserService) => IBaseController<
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
>;

@ApiTags('Users')
@Controller('users')
@EntityName({ singular: 'User', plural: 'Users' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController extends UserCrudControllerBase {
  constructor(override readonly service: UserService) {
    super(service);
  }
}
