import { Controller } from '@nestjs/common';
import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('comment')
@Controller('comment')
export class CommentController extends CreateNestedCrudController(
  CreateCommentDto,
  UpdateCommentDto,
  Comment
) implements IBaseController<CreateCommentDto, UpdateCommentDto, Comment> {
  constructor(override readonly service: CommentService) {
    super(service);
  }
}
