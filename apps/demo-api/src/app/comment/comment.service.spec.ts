import { crudServiceTests } from '@nest-util/nest-crud/testing';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';

describe('CommentService', () => {
  crudServiceTests({
    serviceClass: CommentService,
    entity: Comment,
    createDto: CreateCommentDto,
    updateDto: UpdateCommentDto,
    allowedFilters: [],
    test: {
      createPayload: { text: 'Nice post' },
      updatePayload: { text: 'Updated comment' },
    },
  });
});
