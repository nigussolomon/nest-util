import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { OnboardingJwtGuard } from './onboarding-jwt.guard';
import { AUTH_OPTIONS } from '../constants';

describe('OnboardingJwtGuard', () => {
  let guard: OnboardingJwtGuard;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jwtService: any;

  const mockOptions = {
    userEntity: class User {
      id = 1;
    },
    identifierField: 'email',
    passkeyField: 'password',
    jwtSecret: 'test-secret',
    onboarding: {
      enabled: true,
    },
  };

  const pendingAttempt = {
    id: 1,
    identifierField: 'email',
    identifier: 'alice@example.com',
    consumedAt: null,
  };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
    };
    jwtService = {
      verify: jest.fn(),
    };

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingJwtGuard,
        { provide: AUTH_OPTIONS, useValue: mockOptions },
        { provide: JwtService, useValue: jwtService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    guard = module.get<OnboardingJwtGuard>(OnboardingJwtGuard);
  });

  function mockContext(authHeader?: string) {
    const request: { headers?: Record<string, unknown>; [key: string]: unknown } = {};
    if (authHeader) {
      request.headers = { authorization: authHeader };
    }
    return {
      switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn().mockReturnValue(request) }),
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow a valid unconsumed onboarding token', async () => {
    jwtService.verify.mockReturnValue({
      sub: 1,
      type: 'onboarding',
      identifierField: 'email',
      identifier: 'alice@example.com',
    });
    repository.findOne.mockResolvedValue(pendingAttempt);

    const context = mockContext('Bearer valid.token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.onboardingAttempt).toEqual(pendingAttempt);
    expect(jwtService.verify).toHaveBeenCalledWith(
      'valid.token',
      expect.objectContaining({ secret: 'test-secret' })
    );
  });

  it('should reject when the onboarding token is missing', async () => {
    await expect(guard.canActivate(mockContext())).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should reject an invalid or expired token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('expired');
    });

    await expect(guard.canActivate(mockContext('Bearer bad.token'))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should reject a token that is not an onboarding token', async () => {
    jwtService.verify.mockReturnValue({ sub: 1, type: 'access' });

    await expect(guard.canActivate(mockContext('Bearer wrong.token'))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should reject when the attempt is already consumed', async () => {
    jwtService.verify.mockReturnValue({ sub: 1, type: 'onboarding' });
    repository.findOne.mockResolvedValue({ ...pendingAttempt, consumedAt: new Date() });

    await expect(guard.canActivate(mockContext('Bearer used.token'))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should reject when the attempt no longer exists', async () => {
    jwtService.verify.mockReturnValue({ sub: 999, type: 'onboarding' });
    repository.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(mockContext('Bearer ghost.token'))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should reject when onboarding is disabled', async () => {
    mockOptions.onboarding = { enabled: false };

    await expect(guard.canActivate(mockContext('Bearer any.token'))).rejects.toThrow(
      UnauthorizedException
    );
  });
});
