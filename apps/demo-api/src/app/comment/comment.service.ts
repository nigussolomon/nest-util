import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';

@Injectable()
export class CommentService extends NestCrudService<
  Comment,
  CreateCommentDto,
  UpdateCommentDto
> {
  constructor(
    @InjectRepository(Comment)
    repository: Repository<Comment>,
  ) {
    super({
      repository,
      allowedFilters: [], // Add keys from Comment to allow filtering
    });
  }
}
