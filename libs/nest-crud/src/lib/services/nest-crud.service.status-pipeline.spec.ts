import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NestCrudService } from './nest-crud.service';
import { createMockRepository } from '../testing/mock-repository';

class StatusEntity {
  id!: number;
  name!: string;
  status?: string;
  authorId?: number;
}

const pipeline = {
  field: 'status' as const,
  initial: 'draft',
  transitions: [
    { from: 'draft', to: ['pending'] },
    { from: 'pending', to: ['approved', 'rejected'] },
    { from: 'rejected', to: ['pending'] },
    { from: 'approved', to: ['published'] },
  ],
};

const draft = () => ({ id: 1, name: 'post', status: 'draft' });
const pending = () => ({ id: 1, name: 'post', status: 'pending' });

describe('NestCrudService - status pipeline', () => {
  let repo: ReturnType<typeof createMockRepository<StatusEntity>>;

  function buildService(
    overrides: Record<string, unknown> = {}
  ): NestCrudService<
    StatusEntity,
    Partial<StatusEntity>,
    Partial<StatusEntity>,
    StatusEntity
  > {
    return new NestCrudService<
      StatusEntity,
      Partial<StatusEntity>,
      Partial<StatusEntity>,
      StatusEntity
    >({
      repository: repo as any,
      statusPipeline: pipeline,
      ...overrides,
    });
  }

  beforeEach(() => {
    repo = createMockRepository(StatusEntity);
  });

  describe('create', () => {
    it('auto-applies the initial status when the payload omits it', async () => {
      const service = buildService();

      const result = await service.create({ name: 'post' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'post', status: 'draft' })
      );
      expect(result.status).toBe('draft');
    });

    it('rejects creating with a status outside the initial/allow list', async () => {
      const service = buildService();

      await expect(
        service.create({ name: 'post', status: 'published' })
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows a status listed in allowCreateStatuses', async () => {
      const service = buildService({
        statusPipeline: { ...pipeline, allowCreateStatuses: ['pending'] },
      });

      const result = await service.create({ name: 'post', status: 'pending' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
      expect(result.status).toBe('pending');
    });

    it('does not touch the payload when no pipeline is configured', async () => {
      const service = buildService({ statusPipeline: undefined });

      const result = await service.create({ name: 'post' });

      expect(result.status).toBeUndefined();
    });
  });

  describe('update', () => {
    it('allows a valid status transition', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      const result = await service.update(1, { status: 'pending' });

      expect(repo.save).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('rejects an invalid status transition', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(draft() as any);

      await expect(
        service.update(1, { status: 'published' })
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows an explicit downgrade when it is in the pipeline', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(pending() as any);
      repo.findOne.mockResolvedValue({ ...pending(), status: 'rejected' } as any);

      const result = await service.update(1, { status: 'rejected' });

      expect(result.status).toBe('rejected');
    });

    it('allows setting the same status (no-op)', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(draft() as any);

      const result = await service.update(1, { status: 'draft' });

      expect(result.status).toBe('draft');
    });

    it('rejects a transition from an unregistered current status', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue({ ...draft(), status: 'archived' } as any);

      await expect(
        service.update(1, { status: 'pending' })
      ).rejects.toThrow(BadRequestException);
    });

    it('does not validate when the payload has no status field', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue({ ...draft(), name: 'edited' } as any);

      const result = await service.update(1, { name: 'edited' });

      expect(result.name).toBe('edited');
    });

    it('throws ForbiddenException when a transition permission is missing', async () => {
      const service = buildService({
        statusPipeline: {
          field: 'status',
          initial: 'draft',
          transitions: [
            {
              from: 'draft',
              to: ['pending'],
              permission: 'posts.approve',
            },
          ],
        },
      });
      repo.findOneBy.mockResolvedValue(draft() as any);

      await expect(
        service.update(1, { status: 'pending' }, { id: 1, permissions: ['posts.read'] })
      ).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows a transition when the user has the required permission', async () => {
      const service = buildService({
        statusPipeline: {
          field: 'status',
          initial: 'draft',
          transitions: [
            {
              from: 'draft',
              to: ['pending'],
              permission: 'posts.approve',
            },
          ],
        },
      });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      const result = await service.update(
        1,
        { status: 'pending' },
        { id: 1, permissions: ['posts.approve'] }
      );

      expect(result.status).toBe('pending');
    });
  });

  describe('changeStatus', () => {
    it('throws NotFound when no pipeline is configured', async () => {
      const service = buildService({ statusPipeline: undefined });

      await expect(service.changeStatus(1, 'pending')).rejects.toThrow(
        NotFoundException
      );
    });

    it('performs a valid transition', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      const result = await service.changeStatus(1, 'pending');

      expect(repo.save).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('rejects an invalid transition', async () => {
      const service = buildService();
      repo.findOneBy.mockResolvedValue(draft() as any);

      await expect(service.changeStatus(1, 'published')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('actions', () => {
    const actionsPipeline = {
      field: 'status' as const,
      initial: 'draft',
      transitions: [
        { from: 'draft', to: ['pending'], action: jest.fn() },
        {
          from: 'pending',
          to: ['approved', 'rejected'],
          action: jest.fn(),
        },
      ],
      onTransition: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('fires the edge action with the transition context after the transition is saved', async () => {
      const service = buildService({ statusPipeline: actionsPipeline });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      await service.update(1, { status: 'pending' }, { id: 7, permissions: ['x'] });

      const edgeAction = actionsPipeline.transitions[0]
        .action as jest.Mock;
      expect(edgeAction).toHaveBeenCalledTimes(1);
      expect(edgeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          from: 'draft',
          to: 'pending',
          user: expect.objectContaining({ id: 7 }),
        })
      );
    });

    it('passes the saved entity (new status) to the action context', async () => {
      const service = buildService({ statusPipeline: actionsPipeline });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      await service.update(1, { status: 'pending' });

      const edgeAction = actionsPipeline.transitions[0]
        .action as jest.Mock;
      const context = edgeAction.mock.calls[0][0];
      expect(context.entity.status).toBe('pending');
      expect(context.to).toBe('pending');
    });

    it('fires the global onTransition after the edge action', async () => {
      const service = buildService({ statusPipeline: actionsPipeline });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      await service.update(1, { status: 'pending' });

      expect(actionsPipeline.onTransition).toHaveBeenCalledTimes(1);
      expect(actionsPipeline.onTransition).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'draft', to: 'pending' })
      );
      expect(actionsPipeline.transitions[0].action as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('does not fire actions for a same-status no-op', async () => {
      const service = buildService({ statusPipeline: actionsPipeline });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(draft() as any);

      await service.update(1, { status: 'draft' });

      expect(actionsPipeline.onTransition).not.toHaveBeenCalled();
    });

    it('does not fire actions when the payload does not change the status', async () => {
      const service = buildService({ statusPipeline: actionsPipeline });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue({ ...draft(), name: 'edited' } as any);

      await service.update(1, { name: 'edited' });

      expect(actionsPipeline.onTransition).not.toHaveBeenCalled();
    });

    it('awaits async actions before returning', async () => {
      const order: string[] = [];
      const service = buildService({
        statusPipeline: {
          field: 'status',
          initial: 'draft',
          transitions: [
            {
              from: 'draft',
              to: ['pending'],
              action: async () => {
                order.push('edge');
              },
            },
          ],
          onTransition: async () => {
            order.push('onTransition');
          },
        },
      });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      await service.update(1, { status: 'pending' });

      expect(order).toEqual(['edge', 'onTransition']);
    });

    it('fires the edge action through changeStatus', async () => {
      const service = buildService({ statusPipeline: actionsPipeline });
      repo.findOneBy.mockResolvedValue(draft() as any);
      repo.findOne.mockResolvedValue(pending() as any);

      await service.changeStatus(1, 'pending');

      const edgeAction = actionsPipeline.transitions[0]
        .action as jest.Mock;
      expect(edgeAction).toHaveBeenCalledTimes(1);
      expect(actionsPipeline.onTransition).toHaveBeenCalledTimes(1);
    });

    it('does not fire actions when the transition is rejected', async () => {
      const service = buildService({ statusPipeline: actionsPipeline });
      repo.findOneBy.mockResolvedValue(draft() as any);

      await expect(
        service.update(1, { status: 'published' })
      ).rejects.toThrow(BadRequestException);

      expect(actionsPipeline.onTransition).not.toHaveBeenCalled();
    });
  });
});
