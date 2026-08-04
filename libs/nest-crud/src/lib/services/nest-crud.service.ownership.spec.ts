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
  const roleAdminUser = {
    id: 7,
    userRoles: [{ role: { permissions: ['posts.read', 'admin.access'] } }],
  };
  const unrelatedRoleUser = {
    id: 7,
    userRoles: [{ role: { permissions: ['posts.read', 'billing.read'] } }],
  };

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

    it('bypasses ownership when the bypass permission comes from a role', async () => {
      const service = buildService({
        ownershipBypassPermissions: ['admin.access'],
      });

      const result = await service.findOne(2, roleAdminUser);

      expect(repo.findOne).toHaveBeenCalled();
      expect(result).toEqual(owned);
    });

    it('does not bypass ownership when the role grants an unrelated permission', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([]);
      const service = buildService({
        ownershipBypassPermissions: ['admin.access'],
      });

      await expect(service.findOne(2, unrelatedRoleUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('bypasses ownership when superAdminPermission matches direct permissions', async () => {
      const service = buildService({
        superAdminPermission: 'admin.access',
      });

      const result = await service.findOne(2, adminUser);

      expect(repo.findOne).toHaveBeenCalled();
      expect(result).toEqual(owned);
    });

    it('bypasses ownership when superAdminPermission matches role permissions', async () => {
      const service = buildService({
        superAdminPermission: 'admin.access',
      });

      const result = await service.findOne(2, roleAdminUser);

      expect(repo.findOne).toHaveBeenCalled();
      expect(result).toEqual(owned);
    });

    it('does not bypass ownership when superAdminPermission is not held', async () => {
      const qb = repo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([]);
      const service = buildService({
        superAdminPermission: 'admin.access',
      });

      await expect(service.findOne(2, ownUser)).rejects.toThrow(
        NotFoundException
      );
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

  describe('create', () => {
    it('auto-sets userOwnershipField to the authenticated user id', async () => {
      const service = buildService();

      const result = await service.create({ name: 'new post' } as any, ownUser);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 7, name: 'new post' })
      );
      expect(result).toBeDefined();
    });

    it('allows the plain ownership column when it matches the user id', async () => {
      const service = buildService();

      await service.create({ name: 'ok', authorId: 7 } as any, ownUser);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 7, name: 'ok' })
      );
    });

    it('throws 404 when plain ownership column does not match user id', async () => {
      const service = buildService();

      await expect(
        service.create({ name: 'bad', authorId: 99 } as any, ownUser)
      ).rejects.toThrow(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when enforced but user is missing', async () => {
      const service = buildService();

      await expect(
        service.create({ name: 'orphan' } as any)
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin bypass to set any owner id', async () => {
      const service = buildService({
        ownershipBypassPermissions: ['admin.access'],
      });

      await service.create({ name: 'admin post', authorId: 99 } as any, adminUser);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 99, name: 'admin post' })
      );
    });

    it('also sets the FK column when ownership field matches a relation', async () => {
      const userEntity = { id: 7, name: 'user7' };
      const userRepo = {
        findOneBy: jest.fn().mockResolvedValue(userEntity),
      } as any;

      const service = buildService({
        userOwnershipField: 'author',
        relations: [
          { property: 'author', repo: userRepo, idField: 'authorId' },
        ],
      });

      // No authorId in payload → auto-set
      await service.create({ name: 'post' } as any, ownUser);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'post',
          author: userEntity,
        })
      );
    });

    it('allows matching FK when ownership field maps to a relation', async () => {
      const userEntity = { id: 7, name: 'user7' };
      const userRepo = {
        findOneBy: jest.fn().mockResolvedValue(userEntity),
      } as any;

      const service = buildService({
        userOwnershipField: 'author',
        relations: [
          { property: 'author', repo: userRepo, idField: 'authorId' },
        ],
      });

      await service.create({ name: 'post', authorId: 7 } as any, ownUser);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          author: userEntity,
        })
      );
    });

    it('throws 404 when FK field does not match user id in relation case', async () => {
      const userRepo = {
        findOneBy: jest.fn(),
      } as any;

      const service = buildService({
        userOwnershipField: 'author',
        relations: [
          { property: 'author', repo: userRepo, idField: 'authorId' },
        ],
      });

      await expect(
        service.create({ name: 'post', authorId: 99 } as any, ownUser)
      ).rejects.toThrow(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does nothing when ownership is not configured', async () => {
      const service = buildService({
        userOwnershipField: undefined,
        findMineQuery: undefined,
      });

      await service.create({ name: 'plain' } as any, ownUser);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'plain' })
      );
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
