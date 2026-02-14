import { Controller } from '@nestjs/common';
import {
  CreateNestedCrudController,
  IBaseController,
} from '@nest-util/nest-crud';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';
import { ApiTags } from '@nestjs/swagger';

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
export class CommentController extends CommentCrudControllerBase {
  constructor(override readonly service: CommentService) {
    super(service);
  }
}
