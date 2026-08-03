import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AUTH_OPTIONS } from '../constants';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RoleEntity } from '../entities/role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jwtService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manager: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userRoleRepository: any;

  const mockUserEntity = class User {
    id: number | string = 1;
    email = 'test@example.com';
    password = 'hashedPassword';
    accessToken = 'hashed-at';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockOptions: any = {
    userEntity: mockUserEntity,
    identifierField: 'email',
    passkeyField: 'password',
    jwtSecret: 'test-secret',
  };

  beforeEach(async () => {
    mockOptions.otp = undefined;
    mockOptions.verification = undefined;
    mockOptions.registerHooks = undefined;
    mockOptions.identifierFields = undefined;
    mockOptions.onboarding = undefined;

    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      }),
    };

    roleRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    userRoleRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === RoleEntity) return roleRepository;
        if (entity === UserRoleEntity) return userRoleRepository;
        return repository;
      }),
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
      transaction: jest.fn(
        async (fn: (m: unknown) => unknown) => fn(manager)
      ),
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
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
      });

      const result = await service.register(dto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: [{ email: dto.email }],
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(repository.save).toHaveBeenCalled();
      expect(result.email).toBe(dto.email);
    });

    it('should throw ConflictException if user already exists', async () => {
      const dto = { email: 'exists@example.com', password: 'password123' };
      repository.findOne.mockResolvedValue({ id: 1, email: dto.email });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should allow beforeRegister to mutate the payload', async () => {
      const dto = { email: 'new@example.com', password: 'password123' };
      mockOptions.registerHooks = {
        beforeRegister: jest.fn(async (ctx) => {
          ctx.payload.isActive = true;
        }),
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockImplementation((payload: Record<string, unknown>) => payload);
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
        isActive: true,
      });

      const result = await service.register(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      );
      expect(result.email).toBe(dto.email);
    });

    it('should abort registration when beforeRegister throws', async () => {
      const dto = { email: 'new@example.com', password: 'password123' };
      mockOptions.registerHooks = {
        beforeRegister: jest.fn(async () => {
          throw new BadRequestException('Blocked');
        }),
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should assign a role by name via afterRegister hook', async () => {
      const dto = { email: 'new@example.com', password: 'password123' };
      mockOptions.registerHooks = {
        afterRegister: jest.fn(async (ctx) => {
          await ctx.assignRole('USER');
        }),
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...dto, password: 'hashedPassword' });
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
      });
      roleRepository.findOne.mockResolvedValue({ id: 5, name: 'USER' });

      const result = await service.register(dto);

      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'USER' },
      });
      expect(userRoleRepository.create).toHaveBeenCalledWith({
        userId: 1,
        roleId: 5,
      });
      expect(userRoleRepository.save).toHaveBeenCalled();
      expect(result.email).toBe(dto.email);
    });

    it('should assign a role by id via afterRegister hook', async () => {
      const dto = { email: 'new@example.com', password: 'password123' };
      mockOptions.registerHooks = {
        afterRegister: jest.fn(async (ctx) => {
          await ctx.assignRole(5);
        }),
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...dto, password: 'hashedPassword' });
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
      });
      roleRepository.findOne.mockResolvedValue({ id: 5, name: 'USER' });

      await service.register(dto);

      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(userRoleRepository.create).toHaveBeenCalledWith({
        userId: 1,
        roleId: 5,
      });
    });

    it('should fail registration when afterRegister throws', async () => {
      const dto = { email: 'new@example.com', password: 'password123' };
      mockOptions.registerHooks = {
        afterRegister: jest.fn(async () => {
          throw new InternalServerErrorException('Role assignment failed');
        }),
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...dto, password: 'hashedPassword' });
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
      });

      await expect(service.register(dto)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('should fail registration when the assigned role does not exist', async () => {
      const dto = { email: 'new@example.com', password: 'password123' };
      mockOptions.registerHooks = {
        afterRegister: jest.fn(async (ctx) => {
          await ctx.assignRole('GHOST');
        }),
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...dto, password: 'hashedPassword' });
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
      });
      roleRepository.findOne.mockResolvedValue(null);

      await expect(service.register(dto)).rejects.toThrow(NotFoundException);
      expect(userRoleRepository.save).not.toHaveBeenCalled();
    });

    it('should register a user with multiple identifiers and check conflicts across all', async () => {
      mockOptions.identifierFields = ['email', 'phone'];
      const dto = {
        email: 'new@example.com',
        phone: '+15551234567',
        password: 'password123',
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...dto, password: 'hashedPassword' });
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
      });

      const result = await service.register(dto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: [{ email: dto.email }, { phone: dto.phone }],
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          phone: dto.phone,
        })
      );
      expect(result.email).toBe(dto.email);
      expect(result.phone).toBe(dto.phone);
    });

    it('should throw ConflictException if any identifier already exists', async () => {
      mockOptions.identifierFields = ['email', 'phone'];
      const dto = {
        email: 'new@example.com',
        phone: '+15551234567',
        password: 'password123',
      };
      repository.findOne.mockResolvedValue({ id: 1, phone: dto.phone });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when no identifier is provided', async () => {
      await expect(
        service.register({ password: 'password123' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should deliver the verification code to verification.identifierField', async () => {
      const deliverCode = jest.fn().mockResolvedValue(undefined);
      mockOptions.identifierFields = ['email', 'phone'];
      mockOptions.verification = {
        enabled: true,
        deliverCode,
        identifierField: 'phone',
      };
      const dto = {
        email: 'new@example.com',
        phone: '+15551234567',
        password: 'password123',
      };
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.create.mockReturnValue({ ...dto, password: 'hashedPassword' });
      repository.save.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashedPassword',
      });
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.register(dto);

      expect(deliverCode).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: dto.phone })
      );
    });
  });

  describe('login', () => {
    it('should successfully login and return access/refresh tokens and user without sensitive data', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };
      const user = {
        id: 1,
        email: credentials.email,
        password: 'hashedPassword',
        refreshToken: 'oldToken',
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
      jwtService.sign.mockReturnValue('mock-token');
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.login(credentials);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        `user.${mockOptions.passkeyField}`
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.email = :identifier',
        { identifier: credentials.email }
      );
      expect(queryBuilder.update).toHaveBeenCalled();
      expect(queryBuilder.execute).toHaveBeenCalled();
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.password).toBeUndefined();
      expect(result.user.refreshToken).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'none@example.com', password: 'any' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login using the phone identifier when identifierFields is configured', async () => {
      mockOptions.identifierFields = ['email', 'phone'];
      const credentials = {
        phone: '+15551234567',
        password: 'password123',
      };
      const user = {
        id: 1,
        email: 'test@example.com',
        phone: '+15551234567',
        password: 'hashedPassword',
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
      jwtService.sign.mockReturnValue('mock-token');
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.login(credentials);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.email = :identifier OR user.phone = :identifier',
        { identifier: credentials.phone }
      );
      expect(result.access_token).toBeDefined();
      expect(result.user.phone).toBe(user.phone);
    });

    it('should include all identifier fields in the token payload', async () => {
      mockOptions.identifierFields = ['email', 'phone'];
      const user = {
        id: 1,
        email: 'test@example.com',
        phone: '+15551234567',
        password: 'hashedPassword',
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
      jwtService.sign.mockReturnValue('mock-token');
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.login({ email: user.email, password: 'password123' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ email: user.email, phone: user.phone }),
        expect.anything()
      );
    });
  });

  describe('requestOtp', () => {
    it('should request OTP and call configured delivery callback for existing user', async () => {
      const deliverCode = jest.fn().mockResolvedValue(undefined);
      mockOptions.otp = {
        enabled: true,
        deliverCode,
      };

      const user = {
        id: 1,
        email: 'test@example.com',
        otpRequestAttempts: 0,
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      queryBuilder.execute.mockResolvedValue({ affected: 1 });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-otp');

      const result = await service.requestOtp({ email: 'test@example.com' });

      expect(result).toEqual({ success: true });
      expect(deliverCode).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'test@example.com',
          code: expect.any(String),
          channel: 'email',
        })
      );
    });

    it('should return success without delivery for unknown user to avoid enumeration', async () => {
      const deliverCode = jest.fn().mockResolvedValue(undefined);
      mockOptions.otp = {
        enabled: true,
        deliverCode,
      };

      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(null);

      const result = await service.requestOtp({ email: 'none@example.com' });

      expect(result).toEqual({
        success: expect.any(Boolean),
        message: expect.any(String),
      });
      expect(deliverCode).not.toHaveBeenCalled();
    });

    it('should request OTP by phone when identifierFields is configured', async () => {
      mockOptions.identifierFields = ['email', 'phone'];
      const deliverCode = jest.fn().mockResolvedValue(undefined);
      mockOptions.otp = {
        enabled: true,
        deliverCode,
      };

      const user = {
        id: 1,
        email: 'test@example.com',
        phone: '+15551234567',
        otpRequestAttempts: 0,
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      queryBuilder.execute.mockResolvedValue({ affected: 1 });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-otp');

      const result = await service.requestOtp({ phone: '+15551234567' });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.email = :identifier OR user.phone = :identifier',
        { identifier: '+15551234567' }
      );
      expect(result).toEqual({ success: true });
      expect(deliverCode).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: '+15551234567' })
      );
    });
  });

  describe('loginWithOtp', () => {
    it('should login with OTP and return tokens', async () => {
      mockOptions.otp = {
        enabled: true,
        deliverCode: jest.fn().mockResolvedValue(undefined),
      };

      const user = {
        id: 1,
        email: 'test@example.com',
        otpCodeHash: 'hashed-otp',
        otpCodeExpiresAt: new Date(Date.now() + 60_000),
        otpRequestAttempts: 0,
      };

      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-token');
      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.loginWithOtp({
        email: 'test@example.com',
        otpCode: '123456',
      });

      expect(result.access_token).toBe('mock-token');
      expect(result.refresh_token).toBe('mock-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should reject invalid OTP', async () => {
      mockOptions.otp = {
        enabled: true,
        deliverCode: jest.fn().mockResolvedValue(undefined),
      };

      const user = {
        id: 1,
        email: 'test@example.com',
        otpCodeHash: 'hashed-otp',
        otpCodeExpiresAt: new Date(Date.now() + 60_000),
        otpRequestAttempts: 0,
      };

      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      queryBuilder.execute.mockResolvedValue({ affected: 1 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.loginWithOtp({
          email: 'test@example.com',
          otpCode: '000000',
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should successfully refresh tokens', async () => {
      const oldRefreshToken = 'validToken';
      const user = {
        id: 1,
        email: 'test@example.com',
        refreshToken: 'hashedOldToken',
        password: 'hash',
      };

      jwtService.verify.mockReturnValue({ sub: 1, nonce: 'old-nonce' });
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewToken');
      jwtService.sign.mockReturnValue('new-token');
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.refresh(oldRefreshToken);

      expect(result.access_token).toBe('new-token');
      expect(result.refresh_token).toBe('new-token');
      expect(result.user).toStrictEqual({ id: 1, email: 'test@example.com' });
    });

    it('should throw UnauthorizedException if token invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error();
      });
      await expect(service.refresh('invalid')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.logout(1);

      expect(result).toBe(true);
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if logout fails (user not found)', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.execute.mockResolvedValue({ affected: 0 });

      await expect(service.logout(999)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user without sensitive data if found and token valid', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password: 'hash',
        accessToken: 'hashed-at',
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser({ sub: 1, nonce: 'at-nonce' });
      expect(result).toStrictEqual({ id: 1, email: 'test@example.com' });
    });

    it('should throw UnauthorizedException if token invalid', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        accessToken: 'hashed-at',
      };
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser({ sub: 1, nonce: 'wrong-nonce' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(
        service.validateUser({ sub: 99, nonce: 'any' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should load the configured RBAC relation during validation', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getOne.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accessToken: 'hashed-at',
        roles: [],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: AUTH_OPTIONS,
            useValue: {
              ...mockOptions,
              rbac: {
                userRolesRelation: 'roles',
              },
            },
          },
          {
            provide: DataSource,
            useValue: {
              getRepository: jest.fn().mockReturnValue(repository),
            },
          },
          {
            provide: JwtService,
            useValue: jwtService,
          },
        ],
      }).compile();

      service = module.get<AuthService>(AuthService);

      await service.validateUser({ sub: 1, nonce: 'at-nonce' });

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'user.roles',
        'roles'
      );
    });
  });

  describe('onboarding', () => {
    const deliverCode = jest.fn().mockResolvedValue(undefined);

    const pendingAttempt = {
      id: 1,
      identifierField: 'email',
      identifier: 'alice@example.com',
      codeHash: 'hashedCode',
      codeExpiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      lastSentAt: new Date(Date.now() - 120000),
      lockedUntil: null,
      consumedAt: null,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockOptions.onboarding = {
        enabled: true,
        deliverCode,
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
      repository.update.mockResolvedValue({ affected: 1 });
    });

    describe('startOnboarding', () => {
      it('should create a pending attempt and deliver an OTP', async () => {
        repository.findOne
          .mockResolvedValueOnce(null) // no existing user
          .mockResolvedValueOnce(null); // no pending attempt
        repository.create.mockReturnValue({
          identifierField: 'email',
          identifier: 'alice@example.com',
          attempts: 0,
        });
        repository.save.mockResolvedValue({
          id: 1,
          identifierField: 'email',
          identifier: 'alice@example.com',
          attempts: 0,
        });

        const result = await service.startOnboarding({
          email: 'alice@example.com',
        });

        expect(result).toEqual({ success: true, attemptId: 1 });
        expect(repository.update).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            codeHash: 'hashedCode',
            codeExpiresAt: expect.any(Date),
            attempts: 0,
          })
        );
        expect(deliverCode).toHaveBeenCalledWith(
          expect.objectContaining({
            identifier: 'alice@example.com',
            code: expect.any(String),
            channel: 'email',
          })
        );
      });

      it('should throw ConflictException if the identifier already belongs to a user', async () => {
        repository.findOne.mockResolvedValueOnce({ id: 1, email: 'alice@example.com' });

        await expect(
          service.startOnboarding({ email: 'alice@example.com' })
        ).rejects.toThrow(ConflictException);
        expect(deliverCode).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when no identifier is provided', async () => {
        await expect(service.startOnboarding({})).rejects.toThrow(
          BadRequestException
        );
      });

      it('should delete the attempt and throw when delivery fails', async () => {
        repository.findOne
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
        repository.create.mockReturnValue({
          identifierField: 'email',
          identifier: 'alice@example.com',
        });
        repository.save.mockResolvedValue({ id: 1 });
        deliverCode.mockRejectedValueOnce(new Error('smtp down'));

        await expect(
          service.startOnboarding({ email: 'alice@example.com' })
        ).rejects.toThrow(InternalServerErrorException);
        expect(repository.delete).toHaveBeenCalledWith(1);
      });

      it('should respect the resend cooldown on an existing attempt', async () => {
        repository.findOne
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            ...pendingAttempt,
            lastSentAt: new Date(),
          });

        const result = await service.startOnboarding({
          email: 'alice@example.com',
        });

        expect(result.success).toBe(false);
        expect(deliverCode).not.toHaveBeenCalled();
      });

      it('should reject while the attempt is locked', async () => {
        repository.findOne
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            ...pendingAttempt,
            lockedUntil: new Date(Date.now() + 60000),
          });

        const result = await service.startOnboarding({
          email: 'alice@example.com',
        });

        expect(result.success).toBe(false);
        expect(deliverCode).not.toHaveBeenCalled();
      });
    });

    describe('completeOnboarding', () => {
      it('should validate the OTP and issue a one-purpose onboarding token', async () => {
        repository.findOne.mockResolvedValueOnce(pendingAttempt);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        jwtService.sign.mockReturnValue('signed-onboarding-token');

        const result = await service.completeOnboarding({
          email: 'alice@example.com',
          code: '123456',
        });

        expect(result.onboarding_token).toBe('signed-onboarding-token');
        expect(jwtService.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            sub: 1,
            type: 'onboarding',
            identifier: 'alice@example.com',
          }),
          expect.objectContaining({
            secret: 'test-secret',
            expiresIn: '15m',
          })
        );
        // OTP state cleared, but attempt stays consumable until the user is created.
        expect(repository.update).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ codeHash: null })
        );
      });

      it('should throw UnauthorizedException for an invalid code and increment attempts', async () => {
        repository.findOne.mockResolvedValueOnce(pendingAttempt);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.completeOnboarding({
            email: 'alice@example.com',
            code: '000000',
          })
        ).rejects.toThrow(UnauthorizedException);
        expect(repository.update).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ attempts: 1 })
        );
      });

      it('should lock the attempt after max failed attempts', async () => {
        repository.findOne.mockResolvedValueOnce({
          ...pendingAttempt,
          attempts: 4,
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.completeOnboarding({
            email: 'alice@example.com',
            code: '000000',
          })
        ).rejects.toThrow(BadRequestException);
        expect(repository.update).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ lockedUntil: expect.any(Date) })
        );
      });

      it('should throw UnauthorizedException when the code has expired', async () => {
        repository.findOne.mockResolvedValueOnce({
          ...pendingAttempt,
          codeExpiresAt: new Date(Date.now() - 60000),
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(
          service.completeOnboarding({
            email: 'alice@example.com',
            code: '123456',
          })
        ).rejects.toThrow(UnauthorizedException);
        expect(repository.update).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ codeHash: null })
        );
      });

      it('should throw UnauthorizedException when no pending attempt exists', async () => {
        repository.findOne.mockResolvedValueOnce(null);

        await expect(
          service.completeOnboarding({
            email: 'ghost@example.com',
            code: '123456',
          })
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('createUserFromOnboarding', () => {
      const attempt = {
        id: 1,
        identifierField: 'email',
        identifier: 'alice@example.com',
      };

      it('should create the user with the attempt identifier and no password', async () => {
        const afterRegister = jest.fn().mockResolvedValue(undefined);
        mockOptions.registerHooks = { afterRegister };

        repository.create.mockImplementation(
          (payload: Record<string, unknown>) => payload
        );
        repository.save.mockResolvedValue({
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
        });

        const result = await service.createUserFromOnboarding(
          attempt as never,
          { name: 'Alice' }
        );

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Alice',
            email: 'alice@example.com',
            password: undefined,
          })
        );
        expect(afterRegister).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 1 })
        );
        // Attempt consumed atomically with user creation.
        expect(repository.update).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ consumedAt: expect.any(Date) })
        );
        expect(result.email).toBe('alice@example.com');
        expect(result.password).toBeUndefined();
      });

      it('should run beforeRegister hook mutations', async () => {
        mockOptions.registerHooks = {
          beforeRegister: jest.fn(async (ctx) => {
            ctx.payload.isActive = true;
          }),
        };
        repository.create.mockImplementation(
          (payload: Record<string, unknown>) => payload
        );
        repository.save.mockResolvedValue({
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
          isActive: true,
        });

        await service.createUserFromOnboarding(
          attempt as never,
          { name: 'Alice' }
        );

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: true })
        );
      });

      it('should mark the user verified when verification is enabled', async () => {
        mockOptions.verification = { enabled: true };
        repository.create.mockImplementation(
          (payload: Record<string, unknown>) => payload
        );
        repository.save.mockResolvedValue({
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
          isVerified: true,
        });

        await service.createUserFromOnboarding(
          attempt as never,
          { name: 'Alice' }
        );

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isVerified: true,
            verifiedAt: expect.any(Date),
          })
        );
      });

      it('should throw BadRequestException on identifier mismatch', async () => {
        await expect(
          service.createUserFromOnboarding(
            attempt as never,
            { name: 'Alice', email: 'other@example.com' }
          )
        ).rejects.toThrow(BadRequestException);
        expect(repository.save).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when onboarding is disabled', async () => {
        mockOptions.onboarding = { enabled: false };

        await expect(
          service.createUserFromOnboarding(
            attempt as never,
            { name: 'Alice' }
          )
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
});
