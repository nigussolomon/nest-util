import { Controller, UseGuards } from '@nestjs/common';
import {
  CreateNestedCrudController,
  IBaseController,
} from '@nest-util/nest-crud';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  buildCrudPermissionsFromRegistry,
  JwtAuthGuard,
  PermissionsGuard,
} from '@nest-util/nest-auth';
import { permissionRegistry } from '../auth/permission-registry';

const PostCrudControllerBase = CreateNestedCrudController(
  CreatePostDto,
  UpdatePostDto,
  Post,
  {
    permissions: buildCrudPermissionsFromRegistry(permissionRegistry, {
      resource: 'posts',
    }),
  }
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
}
