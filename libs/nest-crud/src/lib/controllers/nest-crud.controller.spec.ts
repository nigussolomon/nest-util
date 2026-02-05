import { Test, TestingModule } from '@nestjs/testing';
import { NestCrudController } from './nest-crud.controller';

describe('NestCrudController', () => {
  let controller: NestCrudController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NestCrudController],
    }).compile();

    controller = module.get<NestCrudController>(NestCrudController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
