import { FilterDto } from '../dtos/filter.dto';
import { PaginationDto } from '../dtos/pagination.dto';

export interface CrudInterface<CreateDto, UpdateDto, ResponseDto> {
  findAll(query: PaginationDto & FilterDto): Promise<{
    data: ResponseDto[];
    meta?: unknown;
  }>;

  findOne(id: number): Promise<ResponseDto>;

  create(dto: CreateDto): Promise<ResponseDto>;

  update(id: number, dto: UpdateDto): Promise<ResponseDto>;

  remove(id: number): Promise<boolean>;
}
