import { NestCrudService } from './nest-crud.service';
import { CrudHooks } from '../interfaces/hooks.interface';
import { Repository } from 'typeorm';

describe('NestCrudService - Hooks', () => {
  let repo: jest.Mocked<Repository<any>>;
  const mockEntity = { id: 1, name: 'Test' };

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([mockEntity]),
      findOne: jest.fn().mockResolvedValue(mockEntity),
      findOneBy: jest.fn().mockResolvedValue(mockEntity),
      save: jest.fn().mockResolvedValue(mockEntity),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockReturnValue(mockEntity),
      merge: jest.fn(),
      createQueryBuilder: jest.fn(),
      metadata: { name: 'TestEntity', primaryColumns: [{ propertyPath: 'id', type: 'integer' }] },
      manager: {
        connection: {
          createQueryRunner: jest.fn(),
        },
      },
    } as any;
  });

  function createService(hooks?: CrudHooks<any, any, any>) {
    return new NestCrudService({ repository: repo as any, hooks });
  }

  describe('beforeCreate', () => {
    it('should execute beforeCreate hook', async () => {
      const fn = jest.fn();
      const service = createService({
        beforeCreate: { handler: fn, transaction: false },
      });

      await service.create({ name: 'Test' });

      expect(fn).toHaveBeenCalledWith({ payload: { name: 'Test' } });
    });

    it('should execute beforeCreate hook in transaction', async () => {
      const fn = jest.fn();
      const service = createService({
        beforeCreate: { handler: fn, transaction: true },
      });

      const queryRunner = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };
      (repo.manager.connection.createQueryRunner as jest.Mock).mockReturnValue(queryRunner);

      await service.create({ name: 'Test' });

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should rollback if beforeCreate hook fails', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Hook failed'));
      const service = createService({
        beforeCreate: { handler: fn, transaction: true },
      });

      const queryRunner = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };
      (repo.manager.connection.createQueryRunner as jest.Mock).mockReturnValue(queryRunner);

      await expect(service.create({ name: 'Test' })).rejects.toThrow('Hook failed');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('afterCreate', () => {
    it('should execute afterCreate hook', async () => {
      const fn = jest.fn();
      const service = createService({
        afterCreate: { handler: fn, transaction: false },
      });

      await service.create({ name: 'Test' });

      expect(fn).toHaveBeenCalledWith({
        entity: mockEntity,
        payload: { name: 'Test' },
      });
    });
  });

  describe('beforeUpdate', () => {
    it('should execute beforeUpdate hook', async () => {
      const fn = jest.fn();
      const service = createService({
        beforeUpdate: { handler: fn, transaction: false },
      });

      await service.update(1, { name: 'Updated' });

      expect(fn).toHaveBeenCalledWith({
        payload: { name: 'Updated' },
        entity: mockEntity,
        id: 1,
      });
    });
  });

  describe('afterUpdate', () => {
    it('should execute afterUpdate hook', async () => {
      const fn = jest.fn();
      const service = createService({
        afterUpdate: { handler: fn, transaction: false },
      });

      await service.update(1, { name: 'Updated' });

      expect(fn).toHaveBeenCalledWith({
        entity: expect.objectContaining({ id: 1, name: 'Test' }),
        payload: { name: 'Updated' },
        id: 1,
      });
    });
  });

  describe('beforeRemove', () => {
    it('should execute beforeRemove hook', async () => {
      const fn = jest.fn();
      const service = createService({
        beforeRemove: { handler: fn, transaction: false },
      });

      await service.remove(1);

      expect(fn).toHaveBeenCalledWith({
        entity: mockEntity,
        id: 1,
      });
    });
  });

  describe('afterRemove', () => {
    it('should execute afterRemove hook', async () => {
      const fn = jest.fn();
      const service = createService({
        afterRemove: { handler: fn, transaction: false },
      });

      await service.remove(1);

      expect(fn).toHaveBeenCalledWith({ id: 1, deleted: true });
    });
  });

  describe('beforeFindOne', () => {
    it('should execute beforeFindOne hook', async () => {
      const fn = jest.fn();
      const service = createService({
        beforeFindOne: { handler: fn, transaction: false },
      });

      await service.findOne(1);

      expect(fn).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('afterFindOne', () => {
    it('should execute afterFindOne hook', async () => {
      const fn = jest.fn();
      const service = createService({
        afterFindOne: { handler: fn, transaction: false },
      });

      await service.findOne(1);

      expect(fn).toHaveBeenCalledWith({ entity: mockEntity, id: 1 });
    });
  });

  describe('execution order', () => {
    it('should execute beforeCreate before afterCreate', async () => {
      const order: string[] = [];
      const service = createService({
        beforeCreate: {
          handler: async () => { order.push('before'); },
          transaction: false,
        },
        afterCreate: {
          handler: async () => { order.push('after'); },
          transaction: false,
        },
      });

      await service.create({ name: 'Test' });

      expect(order).toEqual(['before', 'after']);
    });
  });

  describe('no hooks', () => {
    it('should work without hooks', async () => {
      const service = createService();
      const result = await service.create({ name: 'Test' });
      expect(result).toEqual(mockEntity);
    });
  });

  describe('payload snapshot with relations', () => {
    const mockOrder = { id: 'order-1', status: 'PENDING' };
    const mockDriver = { id: 'driver-1', status: 'AVAILABLE' };

    function createServiceWithRelations(hooks?: CrudHooks<any, any, any>) {
      const orderRepo = {
        findOneBy: jest.fn().mockResolvedValue(mockOrder),
      } as any;
      const driverRepo = {
        findOneBy: jest.fn().mockResolvedValue(mockDriver),
      } as any;

      const service = new NestCrudService({
        repository: repo as any,
        hooks,
        relations: [
          { property: 'order', repo: orderRepo, idField: 'orderId' },
          { property: 'driver', repo: driverRepo, idField: 'driverId' },
        ],
      });

      return { service, orderRepo, driverRepo };
    }

    it('afterCreate should receive original flat IDs, not mutated payload', async () => {
      const fn = jest.fn();
      const { service } = createServiceWithRelations({
        afterCreate: { handler: fn, transaction: false },
      });

      await service.create({ orderId: 'order-1', driverId: 'driver-1', assignedBy: 'admin' });

      expect(fn).toHaveBeenCalledWith({
        entity: mockEntity,
        payload: { orderId: 'order-1', driverId: 'driver-1', assignedBy: 'admin' },
      });
    });

    it('afterUpdate should receive original flat IDs, not mutated payload', async () => {
      const fn = jest.fn();
      const { service } = createServiceWithRelations({
        afterUpdate: { handler: fn, transaction: false },
      });

      await service.update(1, { orderId: 'order-1', driverId: 'driver-1' });

      expect(fn).toHaveBeenCalledWith({
        entity: expect.objectContaining({ id: 1 }),
        payload: { orderId: 'order-1', driverId: 'driver-1' },
        id: 1,
      });
    });
  });
});
