import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import type { CrudInterface } from '../interfaces/crud.interface';
import { Message } from '../decorators/response-message.decorator';

@Controller()
export abstract class NestCrudController<CreateDto, UpdateDto, ResponseDto> {
  constructor(
    protected readonly service: CrudInterface<CreateDto, UpdateDto, ResponseDto>
  ) {}

  @Get()
  @Message('fetched')
  findAll(@Query() query: PaginationDto & FilterDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Message('fetched')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Message('created')
  create(@Body() dto: CreateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Message('updated')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Message('deleted')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
