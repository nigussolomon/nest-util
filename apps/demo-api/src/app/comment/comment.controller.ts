import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post as HttpPost,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateNestedCrudController,
  FilterDto,
  IBaseController,
  PaginationDto,
} from '@nest-util/nest-crud';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '@nest-util/nest-auth';

const CommentCrudControllerBase = CreateNestedCrudController(
  CreateCommentDto,
  UpdateCommentDto,
  Comment
) as abstract new (service: CommentService) => IBaseController<
  CreateCommentDto,
  UpdateCommentDto,
  Comment
>;

@ApiTags('comment')
@Controller('comment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentController extends CommentCrudControllerBase {
  constructor(override readonly service: CommentService) {
    super(service);
  }

  @Get()
  @RequirePermissions('comments:read')
  override findAll(@Query() query: PaginationDto & FilterDto) {
    return super.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('comments:read')
  override findOne(@Param('id', ParseIntPipe) id: number) {
    return super.findOne(id);
  }

  @HttpPost()
  @RequirePermissions('comments:write')
  override create(@Body() dto: CreateCommentDto) {
    return super.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('comments:write')
  override update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto
  ) {
    return super.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('comments:write')
  override remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
