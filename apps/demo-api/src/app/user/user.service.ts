import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from './user.entity';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import { Role } from '../role/role.entity';

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
    private readonly roleRepository: Repository<Role>
  ) {
    super({
      repository,
      allowedFilters: ['id', 'name', 'email', 'isActive'],
      include: ['roles'],
      toResponseDto: (entity) => {
        if (Array.isArray(entity)) {
          return entity.map((e) => ({
            id: e.id,
            email: e.email,
            name: e.name,
            isActive: e.isActive,
            roles: (e.roles || []).map((role) => ({
              id: role.id,
              name: role.name,
            })),
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          }));
        }
        return {
          id: entity.id,
          email: entity.email,
          name: entity.name,
          isActive: entity.isActive,
          roles: (entity.roles || []).map((role) => ({
            id: role.id,
            name: role.name,
          })),
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        };
      },
    });
  }

  override async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const roles = await this.resolveRoles(dto.roleIds);
    const payload = { ...dto };
    delete payload.roleIds;
    const created = await this.repo.save(
      this.repo.create({
        ...payload,
        roles,
      })
    );

    return this.findOne(created.id);
  }

  override async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const existing = await this.repo.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const { roleIds, ...payload } = dto;
    const roles =
      roleIds === undefined ? existing.roles : await this.resolveRoles(roleIds);

    await this.repo.save({
      ...existing,
      ...payload,
      roles,
    });

    return this.findOne(id);
  }

  private async resolveRoles(roleIds?: number[]): Promise<Role[]> {
    if (roleIds === undefined) {
      const defaultViewerRole = await this.roleRepository.findOne({
        where: { name: 'viewer' },
      });
      return defaultViewerRole ? [defaultViewerRole] : [];
    }

    if (roleIds.length === 0) {
      return [];
    }

    const roles = await this.roleRepository.findBy({
      id: In(roleIds),
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roleIds are invalid');
    }

    return roles;
  }
}
