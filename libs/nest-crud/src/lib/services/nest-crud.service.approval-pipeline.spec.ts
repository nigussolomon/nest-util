import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { NestCrudService } from './nest-crud.service';
import { createMockRepository } from '../testing/mock-repository';
import { ApprovalStatusEntity } from '../entities/approval-status.entity';
import { ModificationRequestHistoryEntity } from '../entities/modification-request-history.entity';
import { APPROVAL_STATUS } from '../interfaces/approval-pipeline.interface';

class ApprovalEntity {
  id!: number;
  name!: string;
}

const submittedRow = () =>
  ({
    id: 1,
    entity: 'approval_entity',
    entityId: '1',
    status: APPROVAL_STATUS.submitted,
    requestedBy: '7',
    requestedAt: new Date('2024-01-01T00:00:00.000Z'),
    currentModifications: null,
  }) as unknown as ApprovalStatusEntity;

const modificationRequestedRow = () =>
  ({
    ...submittedRow(),
    status: APPROVAL_STATUS.modificationRequested,
    currentModifications: [{ field: 'name', wantedValue: 'renamed' }],
  }) as unknown as ApprovalStatusEntity;

describe('NestCrudService - approval pipeline', () => {
  let repo: ReturnType<typeof createMockRepository<ApprovalEntity>>;
  let approvalRepo: jest.Mocked<Repository<ApprovalStatusEntity>>;
  let historyRepo: jest.Mocked<Repository<ModificationRequestHistoryEntity>>;
  let managerMock: {
    transaction: jest.Mock;
    getRepository: jest.Mock;
    connection: { options: { type: string }; createQueryRunner: jest.Mock };
  };

  function buildService(
    overrides: Record<string, unknown> = {}
  ): NestCrudService<
    ApprovalEntity,
    Partial<ApprovalEntity>,
    Partial<ApprovalEntity>,
    ApprovalEntity
  > {
    return new NestCrudService<
      ApprovalEntity,
      Partial<ApprovalEntity>,
      Partial<ApprovalEntity>,
      ApprovalEntity
    >({
      repository: repo as any,
      approvalPipeline: { enabled: true },
      ...overrides,
    });
  }

  beforeEach(() => {
    approvalRepo = {
      findOneBy: jest.fn().mockResolvedValue(submittedRow()),
      create: jest.fn((input) => input),
      save: jest.fn((input) => Promise.resolve(input)),
    } as unknown as jest.Mocked<Repository<ApprovalStatusEntity>>;

    historyRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((input) => input),
      save: jest.fn((input) => Promise.resolve(input)),
    } as unknown as jest.Mocked<Repository<ModificationRequestHistoryEntity>>;

    managerMock = {
      transaction: jest.fn((cb) => cb(managerMock)),
      getRepository: jest.fn((target) => {
        if (target === ApprovalStatusEntity) return approvalRepo;
        if (target === ModificationRequestHistoryEntity) return historyRepo;
        return repo;
      }),
      connection: {
        options: { type: 'postgres' },
        createQueryRunner: jest.fn(),
      },
    } as unknown as typeof managerMock;

    repo = createMockRepository(ApprovalEntity, {
      manager: managerMock as any,
    } as any);
  });

  describe('create', () => {
    it('creates the entity and a draft approval status in one transaction', async () => {
      const service = buildService();
      repo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 1 })
      );

      const result = await service.create({ name: 'post' }, { id: 7 } as any);

      expect(managerMock.transaction).toHaveBeenCalledTimes(1);
      expect(managerMock.getRepository).toHaveBeenCalledWith(ApprovalStatusEntity);
      expect(approvalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'approvalentity',
          entityId: '1',
          status: APPROVAL_STATUS.draft,
        })
      );
      expect(approvalRepo.save).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ name: 'post' }));
    });

    it('skips the approval row when the pipeline is disabled', async () => {
      const service = buildService({
        approvalPipeline: { enabled: false },
      });

      await service.create({ name: 'post' });

      expect(managerMock.transaction).not.toHaveBeenCalled();
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });

    it('skips the approval row when no pipeline is configured', async () => {
      const service = buildService({ approvalPipeline: undefined });

      await service.create({ name: 'post' });

      expect(managerMock.transaction).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('starts a draft without a requestedBy until submitted', async () => {
      const service = buildService();

      await service.create({ name: 'post' });

      expect(approvalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: APPROVAL_STATUS.draft,
        })
      );
    });

    it('creates a submitted approval row and records the requester when initialStatus is submitted', async () => {
      const service = buildService({
        approvalPipeline: { enabled: true, initialStatus: 'submitted' },
      });
      repo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 1 })
      );

      const result = await service.create({ name: 'post' }, { id: 7 } as any);

      expect(approvalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: APPROVAL_STATUS.submitted,
          requestedBy: '7',
        })
      );
      expect(result).toEqual(expect.objectContaining({ name: 'post' }));
    });
  });

  describe('getApproval', () => {
    it('throws NotFound when no pipeline is configured', async () => {
      const service = buildService({ approvalPipeline: undefined });

      await expect(service.getApproval(1)).rejects.toThrow(NotFoundException);
    });

    it('returns the approval status and history', async () => {
      const service = buildService();
      historyRepo.find.mockResolvedValue([
        {
          id: 9,
          approvalStatusId: 1,
          modifications: [{ field: 'name', wantedValue: 'renamed' }],
          requestedBy: '3',
          note: 'please rename',
          requestedAt: new Date('2024-01-02T00:00:00.000Z'),
        } as ModificationRequestHistoryEntity,
      ]);

      const result = await service.getApproval(1);

      expect(result.approval).toEqual(
        expect.objectContaining({ entityId: '1', status: 'submitted' })
      );
      expect(result.history).toHaveLength(1);
      expect(result.history[0]).toEqual(
        expect.objectContaining({ approvalStatusId: 1, note: 'please rename' })
      );
    });

    it('throws NotFound when the entity does not exist', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(null as any);

      await expect(service.getApproval(1)).rejects.toThrow(NotFoundException);
      expect(approvalRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('throws NotFound when no approval row exists', async () => {
      const service = buildService();
      approvalRepo.findOneBy.mockResolvedValue(null as any);

      await expect(service.getApproval(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve / reject', () => {
    it('approves a pending record', async () => {
      const service = buildService();
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.approveApproval(1, { id: 3 } as any);

      expect(approvalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: APPROVAL_STATUS.approved,
          decidedBy: '3',
        })
      );
      expect(result.status).toBe(APPROVAL_STATUS.approved);
    });

    it('rejects a pending record', async () => {
      const service = buildService();
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.rejectApproval(1, { id: 3 } as any);

      expect(result.status).toBe(APPROVAL_STATUS.rejected);
    });

    it('rejects approving an already approved record', async () => {
      const service = buildService();
      approvalRepo.findOneBy.mockResolvedValue({
        ...submittedRow(),
        status: APPROVAL_STATUS.approved,
      } as unknown as ApprovalStatusEntity);

      await expect(service.approveApproval(1)).rejects.toThrow(
        BadRequestException
      );
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFound when the pipeline is disabled', async () => {
      const service = buildService({ approvalPipeline: { enabled: false } });

      await expect(service.approveApproval(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('requestModification', () => {
    const payload = {
      modifications: [{ field: 'name', wantedValue: 'renamed', note: 'typo' }],
      note: 'please adjust',
    };

    it('moves pending to modification_requested and stores history', async () => {
      const service = buildService();
      repo.findOne.mockResolvedValue({ id: 1, name: 'post' } as any);
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.requestModification(
        1,
        payload,
        { id: 5 } as any
      );

      expect(result.status).toBe(APPROVAL_STATUS.modificationRequested);
      expect(approvalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentModifications: [
            expect.objectContaining({
              field: 'name',
              wantedValue: 'renamed',
              currentValue: 'post',
            }),
          ],
        })
      );
      expect(historyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalStatusId: 1,
          modifications: [
            expect.objectContaining({
              field: 'name',
              wantedValue: 'renamed',
              currentValue: 'post',
            }),
          ],
          requestedBy: '5',
          note: 'please adjust',
        })
      );
      expect(historyRepo.save).toHaveBeenCalled();
    });

    it('captures relation objects as the current value', async () => {
      const service = buildService({
        approvalPipeline: { enabled: true, initialStatus: 'submitted' },
        include: ['category'],
      });
      repo.findOne.mockResolvedValue({
        id: 1,
        name: 'post',
        category: { id: 5, name: 'Books' },
      } as any);
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.requestModification(
        1,
        {
          modifications: [{ field: 'category', wantedValue: { id: 9 } }],
        },
        { id: 5 } as any
      );

      expect(result.status).toBe(APPROVAL_STATUS.modificationRequested);
      expect(approvalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentModifications: [
            expect.objectContaining({
              field: 'category',
              currentValue: { id: 5, name: 'Books' },
            }),
          ],
        })
      );
    });

    it('sanitizes circular references in relation objects', async () => {
      const service = buildService({
        approvalPipeline: { enabled: true, initialStatus: 'submitted' },
        include: ['category'],
      });
      const category = { id: 5, name: 'Books' } as any;
      category.self = category;
      repo.findOne.mockResolvedValue({
        id: 1,
        name: 'post',
        category,
      } as any);
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.requestModification(
        1,
        {
          modifications: [{ field: 'category', wantedValue: { id: 9 } }],
        },
        { id: 5 } as any
      );

      expect(result.status).toBe(APPROVAL_STATUS.modificationRequested);
      expect(approvalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentModifications: [
            expect.objectContaining({
              field: 'category',
              currentValue: expect.objectContaining({
                id: 5,
                name: 'Books',
                self: '[Circular]',
              }),
            }),
          ],
        })
      );
    });

    it('rejects requesting modifications on an approved record', async () => {
      const service = buildService();
      approvalRepo.findOneBy.mockResolvedValue({
        ...submittedRow(),
        status: APPROVAL_STATUS.approved,
      } as unknown as ApprovalStatusEntity);

      await expect(
        service.requestModification(1, payload)
      ).rejects.toThrow(BadRequestException);
      expect(historyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('resubmit', () => {
    it('moves modification_requested to resubmitted', async () => {
      const service = buildService();
      approvalRepo.findOneBy.mockResolvedValue(modificationRequestedRow());
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.resubmitApproval(1, { id: 9 } as any);

      expect(result.status).toBe(APPROVAL_STATUS.resubmitted);
      expect(approvalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: APPROVAL_STATUS.resubmitted,
          resubmittedBy: '9',
          currentModifications: null,
        })
      );
    });

    it('rejects resubmitting a pending record', async () => {
      const service = buildService();

      await expect(service.resubmitApproval(1)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('submit', () => {
    it('moves a draft to submitted and records the requester', async () => {
      const service = buildService();
      const draft = {
        ...submittedRow(),
        status: APPROVAL_STATUS.draft,
        requestedBy: undefined,
      } as unknown as ApprovalStatusEntity;
      approvalRepo.findOneBy.mockResolvedValue(draft);
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.submitApproval(1, { id: 11 } as any);

      expect(result.status).toBe(APPROVAL_STATUS.submitted);
      expect(approvalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: APPROVAL_STATUS.submitted,
          requestedBy: '11',
        })
      );
    });

    it('is a no-op when the record is already submitted', async () => {
      const service = buildService();
      const submitted = {
        ...submittedRow(),
        status: APPROVAL_STATUS.submitted,
      } as unknown as ApprovalStatusEntity;
      approvalRepo.findOneBy.mockResolvedValue(submitted);

      const result = await service.submitApproval(1);

      expect(result.status).toBe(APPROVAL_STATUS.submitted);
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('hooks', () => {
    const draftRow = () =>
      ({
        ...submittedRow(),
        status: APPROVAL_STATUS.draft,
        requestedBy: undefined,
      }) as unknown as ApprovalStatusEntity;

    it('fires before and after approve with the correct context', async () => {
      const beforeApprove = jest.fn();
      const afterApprove = jest.fn();
      const service = buildService({
        approvalPipeline: {
          enabled: true,
          hooks: {
            beforeApprove: { handler: beforeApprove },
            afterApprove: { handler: afterApprove },
          },
        },
      });
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.approveApproval(1, { id: 3 } as any);

      expect(beforeApprove).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          user: { id: 3 },
          approval: expect.objectContaining({ status: APPROVAL_STATUS.submitted }),
        })
      );
      expect(afterApprove).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          user: { id: 3 },
          previousStatus: APPROVAL_STATUS.submitted,
          approval: expect.objectContaining({ status: APPROVAL_STATUS.approved }),
        })
      );
      expect(result.status).toBe(APPROVAL_STATUS.approved);
    });

    it('fires before and after reject with the previous status', async () => {
      const beforeReject = jest.fn();
      const afterReject = jest.fn();
      const service = buildService({
        approvalPipeline: {
          enabled: true,
          hooks: {
            beforeReject: { handler: beforeReject },
            afterReject: { handler: afterReject },
          },
        },
      });
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      await service.rejectApproval(1, { id: 3 } as any);

      expect(beforeReject).toHaveBeenCalledWith(
        expect.objectContaining({
          approval: expect.objectContaining({ status: APPROVAL_STATUS.submitted }),
        })
      );
      expect(afterReject).toHaveBeenCalledWith(
        expect.objectContaining({
          previousStatus: APPROVAL_STATUS.submitted,
          approval: expect.objectContaining({ status: APPROVAL_STATUS.rejected }),
        })
      );
    });

    it('fires before and after submit when a transition occurs', async () => {
      const beforeSubmit = jest.fn();
      const afterSubmit = jest.fn();
      const service = buildService({
        approvalPipeline: {
          enabled: true,
          hooks: {
            beforeSubmit: { handler: beforeSubmit },
            afterSubmit: { handler: afterSubmit },
          },
        },
      });
      approvalRepo.findOneBy.mockResolvedValue(draftRow());
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      await service.submitApproval(1, { id: 11 } as any);

      expect(beforeSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          approval: expect.objectContaining({ status: APPROVAL_STATUS.draft }),
        })
      );
      expect(afterSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          previousStatus: APPROVAL_STATUS.draft,
          approval: expect.objectContaining({ status: APPROVAL_STATUS.submitted }),
        })
      );
    });

    it('skips hooks when submit is a no-op', async () => {
      const beforeSubmit = jest.fn();
      const afterSubmit = jest.fn();
      const service = buildService({
        approvalPipeline: {
          enabled: true,
          hooks: {
            beforeSubmit: { handler: beforeSubmit },
            afterSubmit: { handler: afterSubmit },
          },
        },
      });

      await service.submitApproval(1, { id: 11 } as any);

      expect(beforeSubmit).not.toHaveBeenCalled();
      expect(afterSubmit).not.toHaveBeenCalled();
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });

    it('passes modifications and note to request-modification hooks', async () => {
      const beforeRequest = jest.fn();
      const afterRequest = jest.fn();
      const service = buildService({
        approvalPipeline: {
          enabled: true,
          hooks: {
            beforeRequestModification: { handler: beforeRequest },
            afterRequestModification: { handler: afterRequest },
          },
        },
      });
      repo.findOne.mockResolvedValue({ id: 1, name: 'post' } as any);
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const modifications = [
        { field: 'name', wantedValue: 'renamed' },
      ];
      await service.requestModification(
        1,
        { modifications, note: 'please adjust' },
        { id: 5 } as any
      );

      expect(beforeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          modifications,
          note: 'please adjust',
          approval: expect.objectContaining({ status: APPROVAL_STATUS.submitted }),
        })
      );
      expect(afterRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          previousStatus: APPROVAL_STATUS.submitted,
          modifications,
          note: 'please adjust',
          approval: expect.objectContaining({
            status: APPROVAL_STATUS.modificationRequested,
          }),
        })
      );
    });

    it('runs a before hook inside a transaction when requested', async () => {
      const beforeApprove = jest.fn();
      const service = buildService({
        approvalPipeline: {
          enabled: true,
          hooks: {
            beforeApprove: { handler: beforeApprove, transaction: true },
          },
        },
      });
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const queryRunner = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };
      managerMock.connection.createQueryRunner.mockReturnValue(queryRunner);

      await service.approveApproval(1, { id: 3 } as any);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(beforeApprove).toHaveBeenCalledWith(
        expect.objectContaining({
          approval: expect.objectContaining({ status: APPROVAL_STATUS.submitted }),
        })
      );
    });

    it('is a no-op when no approval hooks are configured', async () => {
      const service = buildService();
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      await expect(
        service.approveApproval(1, { id: 3 } as any)
      ).resolves.toEqual(
        expect.objectContaining({ status: APPROVAL_STATUS.approved })
      );
    });
  });

  describe('permissions', () => {
    it('throws Forbidden when the user lacks the configured permission', async () => {
      const service = buildService({
        approvalPipeline: {
          permissions: { approve: 'posts.approve' },
        },
      });

      await expect(
        service.approveApproval(1, { id: 3, permissions: ['posts.read'] } as any)
      ).rejects.toThrow(ForbiddenException);
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });

    it('allows the action when the user has the permission', async () => {
      const service = buildService({
        approvalPipeline: {
          permissions: { approve: 'posts.approve' },
        },
      });
      approvalRepo.save.mockImplementation((row) =>
        Promise.resolve(row as ApprovalStatusEntity)
      );

      const result = await service.approveApproval(1, {
        id: 3,
        permissions: ['posts.approve'],
      } as any);

      expect(result.status).toBe(APPROVAL_STATUS.approved);
    });
  });

  describe('visibleStatuses', () => {
    it('joins approval_statuses and filters on findAll', async () => {
      const service = buildService({
        approvalPipeline: { visibleStatuses: ['approved'] },
      });
      const qb = repo.createQueryBuilder() as any;
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(qb.innerJoin).toHaveBeenCalledWith(
        ApprovalStatusEntity,
        'approvalStatus',
        expect.stringContaining('approvalStatus.status IN'),
        expect.objectContaining({
          approvalEntityName: 'approvalentity',
          approvalVisibleStatuses: ['approved'],
        })
      );
      expect(qb.getManyAndCount).toHaveBeenCalled();
    });

    it('does not join when no visibleStatuses is set', async () => {
      const service = buildService();
      const qb = repo.createQueryBuilder() as any;

      await service.findAll({});

      expect(qb.innerJoin).not.toHaveBeenCalled();
    });

    it('resolves findOne through the query builder when filtering is active', async () => {
      const service = buildService({
        approvalPipeline: { visibleStatuses: ['approved'] },
      });
      const qb = repo.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue({ id: 1, name: 'post' });

      const result = await service.findOne(1);

      expect(qb.andWhere).toHaveBeenCalledWith('e.id = :id', { id: 1 });
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });
  });
});
