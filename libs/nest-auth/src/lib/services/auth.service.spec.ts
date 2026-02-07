import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AUTH_OPTIONS } from '../constants';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let repository: any;
  let jwtService: any;

  const mockUserEntity = class User {
    id = 1;
    email = 'test@example.com';
    password = 'hashedPassword';
  };

  const mockOptions = {
    userEntity: mockUserEntity,
    identifierField: 'email',
    passkeyField: 'password',
    jwtSecret: 'test-secret',
  };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      }),
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AUTH_OPTIONS,
          useValue: mockOptions,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a user', async () => {
      const dto = { email: 'new@example.com', password: 'password123' };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...dto, password: 'hashedPassword' });
      repository.save.mockResolvedValue({ id: 1, ...dto, password: 'hashedPassword' });

      const result = await service.register(dto);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(repository.save).toHaveBeenCalled();
      expect(result.email).toBe(dto.email);
    });

    it('should throw ConflictException if user already exists', async () => {
      const dto = { email: 'exists@example.com', password: 'password123' };
      repository.findOne.mockResolvedValue({ id: 1, email: dto.email });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully login and return access/refresh tokens and user without sensitive data', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      const user = { id: 1, email: credentials.email, password: 'hashedPassword', refreshToken: 'oldToken' };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(credentials);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(`user.${mockOptions.passkeyField}`);
      expect(queryBuilder.where).toHaveBeenCalledWith({ [mockOptions.identifierField]: credentials.email });
      expect(repository.update).toHaveBeenCalledWith(user.id, { refreshToken: 'hashedRefreshToken' });
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.password).toBeUndefined();
      expect(result.user.refreshToken).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(service.login({ email: 'none@example.com', password: 'any' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      const user = { id: 1, email: 'test@example.com', password: 'hashedPassword' };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should successfully refresh tokens', async () => {
      const oldRefreshToken = 'validToken';
      const user = { id: 1, email: 'test@example.com', refreshToken: 'hashedOldToken', password: 'hash' };
      
      jwtService.verify.mockReturnValue({ sub: 1 });
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewToken');
      jwtService.sign.mockReturnValue('new-token');

      const result = await service.refresh(oldRefreshToken);

      expect(result.access_token).toBe('new-token');
      expect(result.refresh_token).toBe('new-token');
      expect(result.user).toStrictEqual({ id: 1, email: 'test@example.com' });
    });

    it('should throw UnauthorizedException if token invalid', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error(); });
      await expect(service.refresh('invalid')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user without sensitive data if found', async () => {
      const user = { id: 1, email: 'test@example.com', password: 'hash' };
      repository.findOne.mockResolvedValue(user);

      const result = await service.validateUser({ sub: 1 });
      expect(result).toStrictEqual({ id: 1, email: 'test@example.com' });
    });

    it('should return null if user not found', async () => {
      repository.findOne.mockResolvedValue(null);
      const result = await service.validateUser({ sub: 99 });
      expect(result).toBeNull();
    });
  });
});
