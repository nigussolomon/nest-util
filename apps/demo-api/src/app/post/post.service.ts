import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { Post } from './post.entity';
import { CreatePostDto } from './create-post.dto';
import { UpdatePostDto } from './update-post.dto';

@Injectable()
export class PostService extends NestCrudService<
  Post,
  CreatePostDto,
  UpdatePostDto
> {
  constructor(
    @InjectRepository(Post)
    repository: Repository<Post>,
  ) {
    super({
      repository,
      allowedFilters: [],
      userOwnershipField: 'authorId',
      enforceOwnership: true,
      ownershipBypassPermissions: ['admin.access'],
      superAdminPermission: 'admin.access',
      statusPipeline: {
        field: 'status',
        initial: 'draft',
        transitions: [
          { from: 'draft', to: ['pending'] },
          { from: 'pending', to: ['approved', 'rejected'] },
          {
            from: 'approved',
            to: ['published'],
            action: async ({ id, entity }) => {
              console.log(`Post ${id} published at ${entity.status}`);
            },
          },
          { from: 'rejected', to: ['pending'] },
        ],
        onTransition: async ({ id, from, to, user }) => {
          console.log(
            `Post ${id} transitioned ${from} -> ${to} by ${user?.id ?? 'anonymous'}`
          );
        },
      },
    });
  }
}
