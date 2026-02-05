import { Controller } from '@nestjs/common';
import { ApiTags, ApiExtraModels } from '@nestjs/swagger';
import { UsersService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import { CreateNestedCrudController, EntityName } from '@nest-util/nest-crud';

@ApiTags('Users')
@ApiExtraModels(CreateUserDto, UpdateUserDto, UserResponseDto)
@Controller('users')
@EntityName({ singular: 'User', plural: 'Users' })
export class UsersController extends CreateNestedCrudController(
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
) {
  constructor(service: UsersService) {
    super(service);
  }
}
