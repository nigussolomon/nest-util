import { Module } from '@nestjs/common';
import { NestCrudService } from './services/nest-crud.service';

@Module({
  providers: [NestCrudService],
  exports: [NestCrudService],
})
export class NestCrudModule {}
