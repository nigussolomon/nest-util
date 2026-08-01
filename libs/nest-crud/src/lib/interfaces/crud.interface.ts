import { FilterDto } from '../dtos/filter.dto';
import { PaginationDto } from '../dtos/pagination.dto';
import { CursorPaginationDto } from '../dtos/cursor-pagination.dto';
import { OwnershipUser } from './find-mine.interface';

export type CrudEndpoint =
  | 'findAll'
  | 'findOne'
  | 'create'
  | 'update'
  | 'remove'
  | 'findAuditLogs'
  | 'findMine';

export interface AuditLogQuery {
  user_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface CursorPaginationResult<T> {
  data: T[];
  meta: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    total?: number;
  };
}

export interface CrudInterface<CreateDto, UpdateDto, ResponseDto> {
  disabledEndpoints?: readonly CrudEndpoint[];

  findAll(query: PaginationDto & FilterDto): Promise<{
    data: ResponseDto[];
    meta?: unknown;
  }>;

  findAllWithCursor?(
    query: CursorPaginationDto & FilterDto
  ): Promise<CursorPaginationResult<ResponseDto>>;

  findOne(id: number, user?: OwnershipUser): Promise<ResponseDto>;

  create(dto: CreateDto, user?: OwnershipUser): Promise<ResponseDto>;

  update(id: number, dto: UpdateDto, user?: OwnershipUser): Promise<ResponseDto>;

  remove(id: number, user?: OwnershipUser): Promise<boolean>;

  findAuditLogs?(query: AuditLogQuery): Promise<unknown>;

  findMine?(
    userId: string | number,
    query: PaginationDto & FilterDto
  ): Promise<{ data: ResponseDto[]; meta?: unknown }>;
}
