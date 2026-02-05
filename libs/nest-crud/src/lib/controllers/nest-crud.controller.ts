import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import type { CrudInterface } from '../interfaces/crud.interface';

@Controller()
export abstract class NestCrudController<CreateDto, UpdateDto, ResponseDto> {
  constructor(
    protected readonly service: CrudInterface<CreateDto, UpdateDto, ResponseDto>
  ) {}

  @Get()
  findAll(@Query() query: PaginationDto & FilterDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  )
  create(@Body() dto: CreateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  )
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
