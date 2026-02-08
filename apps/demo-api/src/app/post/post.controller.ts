import { Controller } from '@nestjs/common';
import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('post')
@Controller('post')
export class PostController extends CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post
) implements IBaseController<CreatePostDto, UpdatePostDto, Post> {
  constructor(override readonly service: PostService) {
    super(service);
  }
}
