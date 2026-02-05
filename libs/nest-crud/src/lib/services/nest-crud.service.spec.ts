import { Test, TestingModule } from '@nestjs/testing';
import { NestCrudService } from './nest-crud.service';

describe('NestCrudService', () => {
  let service: NestCrudService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NestCrudService],
    }).compile();

    service = module.get<NestCrudService>(NestCrudService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
