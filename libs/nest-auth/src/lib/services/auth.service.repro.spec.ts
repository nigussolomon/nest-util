import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AUTH_OPTIONS } from '../constants';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('AuthService Definitive Repro', () => {
  let service: AuthService;
  let repository: any;
  let jwtService: any;
  let queryBuilder: any;

  const mockOptions = {
    userEntity: class User { id = 1; },
    identifierField: 'email',
    passkeyField: 'password',
    jwtSecret: 'test-secret',
    refreshTokenField: 'refreshToken',
  };

  beforeEach(async () => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      addSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('new-token'),
      verify: jest.fn().mockReturnValue({ sub: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_OPTIONS, useValue: mockOptions },
        { provide: DataSource, useValue: { getRepository: () => repository } },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should explicitly nullify and then update refresh token', async () => {
    const refreshToken = 'old-token';
    const user = { id: 1, email: 'test@example.com', refreshToken: 'hashed-old-token' };

    queryBuilder.getOne.mockResolvedValue(user);
    (bcrypt.compare as any) = jest.fn().mockResolvedValue(true);
    (bcrypt.hash as any) = jest.fn().mockResolvedValue('hashed-new-token');

    await service.refresh(refreshToken);

    // Verify first update (nullify)
    expect(queryBuilder.update).toHaveBeenCalled();
    expect(queryBuilder.set).toHaveBeenCalledWith({ refreshToken: null });
    
    // Verify second update (new hash)
    expect(queryBuilder.set).toHaveBeenCalledWith({ refreshToken: 'hashed-new-token' });
    
    // Total executions: 2 (nullify + generateTokens)
    expect(queryBuilder.execute).toHaveBeenCalledTimes(2);
  });

  it('should throw if update affects 0 rows', async () => {
    const refreshToken = 'old-token';
    const user = { id: 1, email: 'test@example.com', refreshToken: 'hashed-old-token' };

    queryBuilder.getOne.mockResolvedValue(user);
    (bcrypt.compare as any) = jest.fn().mockResolvedValue(true);
    queryBuilder.execute.mockResolvedValueOnce({ affected: 0 }); // Nullify fails

    await expect(service.refresh(refreshToken)).rejects.toThrow();
  });
});
