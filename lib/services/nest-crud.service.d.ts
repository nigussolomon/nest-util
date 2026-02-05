import { Type } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import { CrudInterface } from '../interfaces/crud.interface';
export interface CrudServiceOptions<Entity extends ObjectLiteral, ResponseDto> {
    repository: Repository<Entity>;
    allowedFilters?: readonly (keyof Entity)[];
    toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
    createDtoClass?: Type<unknown>;
    updateDtoClass?: Type<unknown>;
}
export declare class NestCrudService<Entity extends ObjectLiteral, CreateDto = Partial<Entity>, UpdateDto = Partial<Entity>, ResponseDto = Entity> implements CrudInterface<CreateDto, UpdateDto, ResponseDto> {
    protected readonly repo: Repository<Entity>;
    protected readonly allowedFilters: readonly (keyof Entity)[];
    protected readonly toResponseDto?: (entity: Entity | Entity[]) => ResponseDto | ResponseDto[];
    protected readonly createDtoClass?: Type<unknown>;
    protected readonly updateDtoClass?: Type<unknown>;
    constructor(options: CrudServiceOptions<Entity, ResponseDto>);
    findAll(query: PaginationDto & FilterDto): Promise<{
        data: ResponseDto[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    } | {
        data: ResponseDto[];
        meta?: undefined;
    }>;
    findOne(id: number): Promise<ResponseDto>;
    create(payload: CreateDto): Promise<ResponseDto>;
    update(id: number, payload: UpdateDto): Promise<ResponseDto>;
    remove(id: number): Promise<boolean>;
}
//# sourceMappingURL=nest-crud.service.d.ts.map