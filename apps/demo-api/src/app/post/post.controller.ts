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
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '@nest-util/nest-auth';

const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post
) as abstract new (service: PostService) => IBaseController<
  CreatePostDto,
  UpdatePostDto,
  Post
>;

@ApiTags('post')
@Controller('post')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PostController extends PostCrudControllerBase {
  constructor(override readonly service: PostService) {
    super(service);
  }

  @Get()
  @RequirePermissions('posts:read')
  override findAll(@Query() query: PaginationDto & FilterDto) {
    return super.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('posts:read')
  override findOne(@Param('id', ParseIntPipe) id: number) {
    return super.findOne(id);
  }

  @HttpPost()
  @RequirePermissions('posts:write')
  override create(@Body() dto: CreatePostDto) {
    return super.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('posts:write')
  override update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePostDto) {
    return super.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('posts:write')
  override remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
