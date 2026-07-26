import { crudControllerTests } from '@nest-util/nest-crud/testing';
import { CreateNestedCrudController } from '@nest-util/nest-crud';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';
import { CommentService } from './comment.service';

const CommentCrudControllerBase = CreateNestedCrudController(
  CreateCommentDto,
  UpdateCommentDto,
  Comment
);

describe('CommentController', () => {
  crudControllerTests({
    controllerFactory: () => CommentCrudControllerBase,
    serviceClass: CommentService,
    entity: Comment,
    createDto: CreateCommentDto,
    updateDto: UpdateCommentDto,
    test: {
      createPayload: { text: 'Nice post' },
      updatePayload: { text: 'Updated comment' },
    },
  });
});
