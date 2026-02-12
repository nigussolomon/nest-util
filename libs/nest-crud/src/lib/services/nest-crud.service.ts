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
  include?: readonly (keyof Entity)[];
  relations?: {
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;
  }[];
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
  protected readonly include: readonly (keyof Entity)[];
  protected readonly relations: {
    property: keyof Entity;
    repo: Repository<ObjectLiteral>;
    idField?: string;
  }[];
  protected readonly toResponseDto?: (
    entity: Entity | Entity[]
  ) => ResponseDto | ResponseDto[];
  protected readonly createDtoClass?: Type<unknown>;
  protected readonly updateDtoClass?: Type<unknown>;

  constructor(options: CrudServiceOptions<Entity, ResponseDto>) {
    this.repo = options.repository;
    this.allowedFilters = options.allowedFilters ?? [];
    this.include = options.include ?? [];
    this.relations = options.relations ?? [];
    this.toResponseDto = options.toResponseDto;
    this.createDtoClass = options.createDtoClass;
    this.updateDtoClass = options.updateDtoClass;
  }

  private async resolveRelations<T extends ObjectLiteral>(
    payload: T
  ): Promise<T> {
    if (!this.relations.length) return payload;

    for (const relation of this.relations) {
      const idField = relation.idField ?? `${String(relation.property)}Id`;

      if (!(idField in payload)) continue;

      const id = payload[idField as keyof T];
      if (!id) continue;

      const entity = await relation.repo.findOneBy({
        id,
      } as unknown as Partial<ObjectLiteral>);

      if (!entity) {
        throw new NotFoundException(`${String(relation.property)} not found`);
      }

      (payload as unknown as Record<string, unknown>)[
        String(relation.property)
      ] = entity;

      delete (payload as unknown as Record<string, unknown>)[idField];
    }

    return payload;
  }

  async findAll(query: PaginationDto & FilterDto) {
    const qb = this.repo.createQueryBuilder('e');

    if (this.include.length > 0) {
      this.include.forEach((relation) => {
        qb.leftJoinAndSelect(`e.${String(relation)}`, String(relation));
      });
    }

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
    const entity = await this.repo.findOne({
      where: { id } as unknown as Partial<Entity>,
      relations: this.include as string[],
    });

    if (!entity) {
      throw new NotFoundException('Resource not found');
    }

    return this.toResponseDto
      ? (this.toResponseDto(entity) as ResponseDto)
      : (entity as unknown as ResponseDto);
  }

  async create(payload: CreateDto) {
    const resolved = await this.resolveRelations(
      payload as unknown as ObjectLiteral
    );

    const entity = await this.repo.save(resolved as unknown as Entity);

    return this.toResponseDto
      ? (this.toResponseDto(entity) as ResponseDto)
      : (entity as unknown as ResponseDto);
  }

  async update(id: number, payload: UpdateDto) {
    const existing = await this.repo.findOneBy({
      id,
    } as unknown as Partial<Entity>);

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    const resolved = await this.resolveRelations(
      payload as unknown as ObjectLiteral
    );

    await this.repo.update(id, resolved as unknown as Partial<Entity>);

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
