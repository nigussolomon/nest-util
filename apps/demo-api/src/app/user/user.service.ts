import { Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import { Role } from './role.entity';
import { UserRole } from './user-role.entity';
import { AssignRoleDto } from './assign-role.dto';

@Injectable()
export class UsersService extends NestCrudService<
  User,
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto
> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {
    super({
      repository,
      allowedFilters: ['id', 'name', 'email', 'isActive'],
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

  async assignRole(userId: number, dto: AssignRoleDto): Promise<Role> {
    let role = await this.roleRepository.findOne({
      where: { name: dto.name },
    });

    if (!role) {
      role = this.roleRepository.create({
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions ?? [],
      });
      role = await this.roleRepository.save(role);
    } else if (dto.description || dto.permissions) {
      role.description = dto.description ?? role.description;
      role.permissions = dto.permissions ?? role.permissions;
      role = await this.roleRepository.save(role);
    }

    const existingAssignment = await this.userRoleRepository.findOne({
      where: { userId, roleId: role.id },
    });

    if (!existingAssignment) {
      const assignment = this.userRoleRepository.create({
        userId,
        roleId: role.id,
      });
      await this.userRoleRepository.save(assignment);
    }

    return role;
  }

  async listRoles(userId: number): Promise<Role[]> {
    const assignments = await this.userRoleRepository.find({
      where: { userId },
      relations: { role: true },
    });

    return assignments.map((assignment) => assignment.role);
  }
}
