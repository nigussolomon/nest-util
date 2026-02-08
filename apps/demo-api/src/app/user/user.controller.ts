import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiExtraModels, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import { CreateNestedCrudController, EntityName, IBaseController } from '@nest-util/nest-crud';
import { JwtAuthGuard } from '@nest-util/nest-auth';

@ApiTags('Users')
@ApiExtraModels(CreateUserDto, UpdateUserDto, UserResponseDto)
@Controller('users')
@EntityName({ singular: 'User', plural: 'Users' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController extends CreateNestedCrudController(
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
) implements IBaseController<CreateUserDto, UpdateUserDto, UserResponseDto> {
  constructor(service: UsersService) {
    super(service);
  }
}
