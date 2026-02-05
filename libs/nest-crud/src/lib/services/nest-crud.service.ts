import { Injectable, NotFoundException, Type } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { applyFilters } from '../helpers/filter.helper';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import { applyPagination } from '../helpers/pagination.helper';
import { CrudInterface } from '../interfaces/crud.interface';

export interface CrudServiceOptions<Entity extends ObjectLiteral, ResponseDto> {
  repository: Repository<Entity>;
  allowedFilters?: readonly (keyof Entity)[];
  toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
  createDtoClass?: Type<unknown>;
  updateDtoClass?: Type<unknown>;
}

@Injectable()
export class NestCrudService<
  Entity extends ObjectLiteral,
  CreateDto = Partial<Entity>,
  UpdateDto = Partial<Entity>,
  ResponseDto = Entity
> implements CrudInterface<CreateDto, UpdateDto, ResponseDto>
{
  protected readonly repo: Repository<Entity>;
  protected readonly allowedFilters: readonly (keyof Entity)[];
  protected readonly toResponseDto?: (
    entity: Entity | Entity[]
  ) => ResponseDto | ResponseDto[];
  protected readonly createDtoClass?: Type<unknown>;
  protected readonly updateDtoClass?: Type<unknown>;

  constructor(options: CrudServiceOptions<Entity, ResponseDto>) {
    this.repo = options.repository;
    this.allowedFilters = options.allowedFilters ?? [];
    this.toResponseDto = options.toResponseDto;
    this.createDtoClass = options.createDtoClass;
    this.updateDtoClass = options.updateDtoClass;
  }

  async findAll(query: PaginationDto & FilterDto) {
    const qb = this.repo.createQueryBuilder('e');

    applyFilters(qb, query.filter, this.allowedFilters);

    const paginationMeta = applyPagination(qb, query);

    const [entities, total] = await qb.getManyAndCount();

    const data = this.toResponseDto
      ? (this.toResponseDto(entities) as ResponseDto[])
      : (entities as unknown as ResponseDto[]);

    return paginationMeta
      ? { data, meta: { ...paginationMeta, total } }
      : { data };
  }

  async findOne(id: number) {
    const entity = await this.repo.findOneBy({ id } as unknown as Entity);

    if (!entity) {
      throw new NotFoundException('Resource not found');
    }

    return this.toResponseDto
      ? (this.toResponseDto(entity) as ResponseDto)
      : (entity as unknown as ResponseDto);
  }

  async create(payload: CreateDto) {
    const entity = await this.repo.save(payload as unknown as Entity);

    return this.toResponseDto
      ? (this.toResponseDto(entity) as ResponseDto)
      : (entity as unknown as ResponseDto);
  }

  async update(id: number, payload: UpdateDto) {
    const existing = await this.repo.findOneBy({ id } as unknown as Entity);

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    await this.repo.update(id, payload as unknown as Entity);

    return this.findOne(id);
  }

  async remove(id: number) {
    const result = await this.repo.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('Resource not found');
    }

    return true;
  }
}
