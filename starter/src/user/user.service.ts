import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';

@Injectable()
export class UserService extends NestCrudService<
  User,
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>
  ) {
    super({
      repository,
      allowedFilters: ['id', 'email', 'name', 'isActive'],
      toResponseDto: (entity) => {
        if (Array.isArray(entity)) {
          return entity.map((e) => ({
            id: e.id,
            email: e.email,
            name: e.name,
            isActive: e.isActive,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          }));
        }
        return {
          id: entity.id,
          email: entity.email,
          name: entity.name,
          isActive: entity.isActive,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        };
      },
    });
  }
}
