import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NestCrudService } from './nest-crud.service';
import { createMockRepository } from '../testing/mock-repository';

class MockEntity {
  id!: number;
  name!: string;
  authorId!: number;
}

describe('NestCrudService - ownership enforcement', () => {
  let repo: ReturnType<typeof createMockRepository<MockEntity>>;
  const owned = { id: 1, name: 'mine', authorId: 7 };
  const others = { id: 2, name: 'theirs', authorId: 9 };

  const ownUser = { id: 7, permissions: ['posts.read'] };
  const adminUser = { id: 7, permissions: ['posts.read', 'admin.access'] };

  function buildService(overrides: Record<string, unknown> = {}) {
    return new NestCrudService<
      MockEntity,
      Partial<MockEntity>,
      Partial<MockEntity>,
      MockEntity
    >({
      repository: repo as any,
      userOwnershipField: 'authorId',
      enforceOwnership: true,
      ...overrides,
    });
  }

  beforeEach(() => {
    repo = createMockRepository(MockEntity);
    repo.findOne.mockResolvedValue(owned as any);
    repo.findOneBy.mockResolvedValue(owned as any);
  });

  describe('findOne', () => {
    it('returns the record when the user owns it', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([owned]);
      const service = buildService();

      const result = await service.findOne(1, ownUser);

      expect(qb.andWhere).toHaveBeenCalledWith('e.id = :id', { id: 1 });
      expect(qb.where).toHaveBeenCalledWith('e.authorId = :userId', {
        userId: 7,
      });
      expect(result).toEqual(owned);
    });

    it('throws NotFoundException when the record belongs to someone else', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([]);
      const service = buildService();

      await expect(service.findOne(2, ownUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('uses the custom findMineQuery when configured', async () => {
      const customQuery = jest.fn();
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([owned]);
      const service = buildService({ findMineQuery: customQuery });

      await service.findOne(1, ownUser);

      expect(customQuery).toHaveBeenCalledWith(qb, 7);
      expect(qb.andWhere).toHaveBeenCalledWith('e.id = :id', { id: 1 });
    });

    it('bypasses ownership when user has a bypass permission', async () => {
      const service = buildService({
        ownershipBypassPermissions: ['admin.access'],
      });

      const result = await service.findOne(2, adminUser);

      expect(repo.findOne).toHaveBeenCalled();
      expect(result).toEqual(owned);
    });

    it('bypasses ownership via custom predicate', async () => {
      const service = buildService({
        ownershipBypass: (user: { id: number; permissions: readonly string[] }) => user.id === 7,
      });

      const result = await service.findOne(2, ownUser);

      expect(repo.findOne).toHaveBeenCalled();
      expect(result).toEqual(owned);
    });

    it('throws ForbiddenException when enforced but user is missing', async () => {
      const service = buildService();

      await expect(service.findOne(1)).rejects.toThrow(ForbiddenException);
    });

    it('keeps old behavior when enforcement is off', async () => {
      const service = buildService({ enforceOwnership: false });

      const result = await service.findOne(2, ownUser);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 2 },
        relations: undefined,
      });
      expect(result).toEqual(owned);
    });

    it('keeps old behavior when ownership is not configured', async () => {
      const service = buildService({
        userOwnershipField: undefined,
        findMineQuery: undefined,
      });

      const result = await service.findOne(2, ownUser);

      expect(repo.findOne).toHaveBeenCalled();
      expect(result).toEqual(owned);
    });
  });

  describe('update', () => {
    it('updates the record when the user owns it', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([owned]);
      const service = buildService();

      const result = await service.update(1, { name: 'updated' }, ownUser);

      expect(qb.andWhere).toHaveBeenCalledWith('e.id = :id', { id: 1 });
      expect(repo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when the record belongs to someone else', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([]);
      const service = buildService();

      await expect(
        service.update(2, { name: 'updated' }, ownUser)
      ).rejects.toThrow(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when enforced but user is missing', async () => {
      const service = buildService();

      await expect(
        service.update(1, { name: 'updated' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('bypasses ownership for bypass permissions', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([others]);
      repo.findOne.mockResolvedValue(others);
      const service = buildService({
        ownershipBypassPermissions: ['admin.access'],
      });

      const result = await service.update(2, { name: 'updated' }, adminUser);

      expect(repo.findOneBy).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('deletes the record when the user owns it', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([owned]);
      const service = buildService();

      const result = await service.remove(1, ownUser);

      expect(qb.andWhere).toHaveBeenCalledWith('e.id = :id', { id: 1 });
      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('throws NotFoundException when the record belongs to someone else', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([]);
      const service = buildService();

      await expect(service.remove(2, ownUser)).rejects.toThrow(
        NotFoundException
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when enforced but user is missing', async () => {
      const service = buildService();

      await expect(service.remove(1)).rejects.toThrow(ForbiddenException);
    });

    it('bypasses ownership for bypass permissions', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([others]);
      repo.findOneBy.mockResolvedValue(others);
      const service = buildService({
        ownershipBypassPermissions: ['admin.access'],
      });

      const result = await service.remove(2, adminUser);

      expect(repo.findOneBy).toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(2);
      expect(result).toBe(true);
    });
  });
});
