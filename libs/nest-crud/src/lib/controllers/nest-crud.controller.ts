import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
  Type,
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Message } from '../decorators/response-message.decorator';
import { CrudInterface } from '../interfaces/crud.interface';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';

export interface IBaseController<CD, UD, RD> {
  service: CrudInterface<CD, UD, RD>;
  findAll(
    query: PaginationDto & FilterDto
  ): Promise<{ data: RD[]; meta?: unknown } | RD[]>;
  findOne(id: number): Promise<RD>;
  create(dto: CD): Promise<RD>;
  update(id: number, dto: UD): Promise<RD>;
  remove(id: number): Promise<boolean>;
}

export function CreateNestedCrudController<CD, UD, RD>(
  createDto: Type<CD>,
  updateDto: Type<UD>,
  responseDto: Type<RD>
): Type<IBaseController<CD, UD, RD>> {
  abstract class BaseController implements IBaseController<CD, UD, RD> {
    constructor(public readonly service: CrudInterface<CD, UD, RD>) {}

    @Get()
    @Message('fetched')
    @ApiResponse({ type: [responseDto] })
    @ApiQuery({
      name: 'filter',
      required: false,
      style: 'deepObject',
      explode: true,
      type: 'object',
      description:
        'Filters in format filter[field_operator]=value. Operators: eq, cont, gte, lte',
      example: { name_cont: 'Alice', isActive_eq: 'true' },
    })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    findAll(@Query() query: PaginationDto & FilterDto) {
      return this.service.findAll(query);
    }

    @Get(':id')
    @Message('fetched')
    @ApiResponse({ type: responseDto })
    findOne(@Param('id', ParseIntPipe) id: number) {
      return this.service.findOne(id);
    }

    @Post()
    @Message('created')
    @ApiBody({ type: createDto })
    @ApiResponse({ type: responseDto })
    create(@Body() dto: CD) {
      return this.service.create(dto);
    }

    @Patch(':id')
    @Message('updated')
    @ApiBody({ type: updateDto })
    @ApiResponse({ type: responseDto })
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UD) {
      return this.service.update(id, dto);
    }

    @Delete(':id')
    @Message('deleted')
    remove(@Param('id', ParseIntPipe) id: number) {
      return this.service.remove(id);
    }
  }

  return BaseController as Type<IBaseController<CD, UD, RD>>;
}
