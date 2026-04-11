import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Role } from './role.entity';
import { Permission } from '../permission/permission.entity';
import { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from './role.dto';

@Injectable()
export class RoleService extends NestCrudService<
  Role,
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto
> {
  constructor(
    @InjectRepository(Role)
    repository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>
  ) {
    super({
      repository,
      allowedFilters: ['id', 'name'],
      include: ['permissions'],
      toResponseDto: (entity) => {
        if (Array.isArray(entity)) {
          return entity.map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: (role.permissions || []).map((permission) => ({
              id: permission.id,
              key: permission.key,
              resource: permission.resource,
              action: permission.action,
            })),
          }));
        }

        return {
          id: entity.id,
          name: entity.name,
          description: entity.description,
          permissions: (entity.permissions || []).map((permission) => ({
            id: permission.id,
            key: permission.key,
            resource: permission.resource,
            action: permission.action,
          })),
        };
      },
    });
  }

  override async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    const permissions = await this.resolvePermissions(dto.permissionIds);
    const payload = { ...dto };
    delete payload.permissionIds;
    const created = await this.repo.save(
      this.repo.create({
        ...payload,
        permissions,
      })
    );

    return this.findOne(created.id);
  }

  override async update(id: number, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const existing = await this.repo.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const { permissionIds, ...payload } = dto;
    const permissions =
      permissionIds === undefined
        ? existing.permissions
        : await this.resolvePermissions(permissionIds);

    await this.repo.save({
      ...existing,
      ...payload,
      permissions,
    });

    return this.findOne(id);
  }

  private async resolvePermissions(permissionIds?: number[]): Promise<Permission[]> {
    if (permissionIds === undefined) {
      return [];
    }

    if (permissionIds.length === 0) {
      return [];
    }

    const permissions = await this.permissionRepository.findBy({
      id: In(permissionIds),
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissionIds are invalid');
    }

    return permissions;
  }
}
