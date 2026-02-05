import { Controller } from '@nestjs/common';
import { UsersService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import { EntityName, NestCrudController } from '@nest-util/nest-crud';

@Controller('users')
@EntityName({ singular: 'User', plural: 'Users' })
export class UsersController extends NestCrudController<
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
> {
  constructor(protected override readonly service: UsersService) {
    super(service);
  }
}
