import { FilterDto } from '../dtos/filter.dto';
import { PaginationDto } from '../dtos/pagination.dto';

export type CrudEndpoint =
  | 'findAll'
  | 'findOne'
  | 'create'
  | 'update'
  | 'remove';

export interface CrudInterface<CreateDto, UpdateDto, ResponseDto> {
  disabledEndpoints?: readonly CrudEndpoint[];

  findAll(query: PaginationDto & FilterDto): Promise<{
    data: ResponseDto[];
    meta?: unknown;
  }>;

  findOne(id: number): Promise<ResponseDto>;

  create(dto: CreateDto): Promise<ResponseDto>;

  update(id: number, dto: UpdateDto): Promise<ResponseDto>;

  remove(id: number): Promise<boolean>;
}
