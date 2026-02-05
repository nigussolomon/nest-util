import { Type } from '@nestjs/common';
import { CrudInterface } from '../interfaces/crud.interface';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
export interface IBaseController<CD, UD, RD> {
    service: CrudInterface<CD, UD, RD>;
    findAll(query: PaginationDto & FilterDto): Promise<{
        data: RD[];
        meta?: unknown;
    } | RD[]>;
    findOne(id: number): Promise<RD>;
    create(dto: CD): Promise<RD>;
    update(id: number, dto: UD): Promise<RD>;
    remove(id: number): Promise<boolean>;
}
export declare function CreateNestedCrudController<CD, UD, RD>(createDto: Type<CD>, updateDto: Type<UD>, responseDto: Type<RD>): Type<IBaseController<CD, UD, RD>>;
//# sourceMappingURL=nest-crud.controller.d.ts.map