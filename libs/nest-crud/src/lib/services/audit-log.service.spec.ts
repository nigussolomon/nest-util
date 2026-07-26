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
            createQueryBuilder: jest.fn(),
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

  it('should list audit logs with filters and pagination', async () => {
    const queryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
    };

    (repo.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);

    const result = await service.findAll({
      entity: 'User',
      userId: '7',
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-01-31T23:59:59.999Z'),
      page: 2,
      limit: 5,
    });

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('auditLog');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'auditLog.entity = :entity',
      { entity: 'User' }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'auditLog.userId = :userId',
      { userId: '7' }
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      data: [{ id: '1' }],
      meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
    });
  });
});
