import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Permission } from './permission.entity';
import {
  CreatePermissionDto,
  PermissionResponseDto,
  UpdatePermissionDto,
} from './permission.dto';

@Injectable()
export class PermissionService extends NestCrudService<
  Permission,
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionResponseDto
> {
  constructor(
    @InjectRepository(Permission)
    repository: Repository<Permission>
  ) {
    super({
      repository,
      allowedFilters: ['id', 'key', 'resource', 'action'],
      toResponseDto: (entity) => {
        if (Array.isArray(entity)) {
          return entity.map((permission) => ({
            id: permission.id,
            key: permission.key,
            resource: permission.resource,
            action: permission.action,
            description: permission.description,
          }));
        }

        return {
          id: entity.id,
          key: entity.key,
          resource: entity.resource,
          action: entity.action,
          description: entity.description,
        };
      },
    });
  }

  override async create(dto: CreatePermissionDto): Promise<PermissionResponseDto> {
    const normalized = this.normalize(dto);
    const created = await this.repo.save(this.repo.create(normalized));
    return this.findOne(created.id);
  }

  override async update(
    id: number,
    dto: UpdatePermissionDto
  ): Promise<PermissionResponseDto> {
    const current = await this.repo.findOneBy({ id });
    if (!current) {
      throw new NotFoundException('Permission not found');
    }

    const merged = this.normalize({
      ...current,
      ...dto,
    });
    await this.repo.update(id, merged);
    return this.findOne(id);
  }

  private normalize(
    dto: Partial<CreatePermissionDto>
  ): Partial<CreatePermissionDto> & { key: string } {
    const resource = dto.resource?.trim();
    const action = dto.action?.trim();
    const key = dto.key?.trim() || (resource && action ? `${resource}:${action}` : '');

    return {
      ...dto,
      resource,
      action,
      key,
      description: dto.description?.trim(),
    };
  }
}
