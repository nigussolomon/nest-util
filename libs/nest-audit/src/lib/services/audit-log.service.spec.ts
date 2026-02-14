import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit-log.service';
import { AuditLogEntity } from '../entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Repository<AuditLogEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = module.get(getRepositoryToken(AuditLogEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create and save an audit log', async () => {
    const input = {
      action: 'DELETE_USER',
      entity: 'User',
      entityId: '999',
      userId: '1',
    };

    const createdEntity: AuditLogEntity = {
      id: 'uuid',
      action: 'DELETE_USER',
      entity: 'User',
      entityId: '999',
      userId: '1',
      metadata: undefined,
      ip: undefined,
      userAgent: undefined,
      tenantId: undefined,
      createdAt: new Date(),
    };

    repo.create.mockReturnValue(createdEntity);
    repo.save.mockResolvedValue(createdEntity);

    const result = await service.log(input);

    expect(repo.create).toHaveBeenCalledWith({
      action: 'DELETE_USER',
      entity: 'User',
      entityId: '999',
      userId: '1',
      metadata: undefined,
      ip: undefined,
      userAgent: undefined,
    });

    expect(repo.save).toHaveBeenCalledWith(createdEntity);
    expect(result).toEqual(createdEntity);
  });

  it('should log entity action using helper method', async () => {
    const createdEntity = {
      id: 'uuid',
      action: 'DELETE_USER',
      entity: 'User',
      entityId: '999',
      userId: '1',
    };

    repo.create.mockReturnValue(createdEntity as AuditLogEntity);
    repo.save.mockResolvedValue(createdEntity as AuditLogEntity);

    const result = await service.logEntityAction('DELETE_USER', 'User', '999', {
      userId: '1',
    });

    expect(repo.create).toHaveBeenCalledWith({
      action: 'DELETE_USER',
      entity: 'User',
      entityId: '999',
      userId: '1',
    });

    expect(repo.save).toHaveBeenCalled();
    expect(result).toEqual(createdEntity);
  });
});
