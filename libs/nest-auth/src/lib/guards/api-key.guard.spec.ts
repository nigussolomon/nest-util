import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from '../services/api-key.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeyService: jest.Mocked<ApiKeyService>;

  const createContext = (headers: Record<string, string>) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    apiKeyService = {
      validate: jest.fn(),
    } as any;

    guard = new ApiKeyGuard(
      apiKeyService,
      {
        userEntity: class User {},
        identifierField: 'email',
        passkeyField: 'password',
        jwtSecret: 'secret',
        apiKey: { enabled: true, headerName: 'x-api-key' },
      },
    );
  });

  it('allows access when no API key header is present', async () => {
    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
  });

  it('sets request.user and request.apiKey on valid key', async () => {
    const user = { id: 1, roles: [], permissions: [] };
    const apiKey = { id: 'uuid-1', userId: 1 };
    apiKeyService.validate.mockResolvedValue({ user, apiKey } as any);

    const request: Record<string, unknown> = { headers: { 'x-api-key': 'nuk_live_abc' } };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toBe(user);
    expect(request['apiKey']).toBe(apiKey);
  });

  it('throws UnauthorizedException on invalid key', async () => {
    apiKeyService.validate.mockRejectedValue(
      new UnauthorizedException('Invalid API key')
    );

    await expect(
      guard.canActivate(createContext({ 'x-api-key': 'nuk_live_wrong' }))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException on revoked key', async () => {
    apiKeyService.validate.mockRejectedValue(
      new UnauthorizedException('API key has been revoked')
    );

    await expect(
      guard.canActivate(createContext({ 'x-api-key': 'nuk_live_revoked' }))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('uses custom header name from options', async () => {
    guard = new ApiKeyGuard(
      apiKeyService,
      {
        userEntity: class User {},
        identifierField: 'email',
        passkeyField: 'password',
        jwtSecret: 'secret',
        apiKey: { enabled: true, headerName: 'x-my-api-key' },
      },
    );

    const user = { id: 1 };
    apiKeyService.validate.mockResolvedValue({ user, apiKey: {} } as any);

    const request = { headers: { 'x-my-api-key': 'nuk_live_abc' } };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    expect(apiKeyService.validate).toHaveBeenCalledWith('nuk_live_abc');
  });

  it('allows access with empty API key header', async () => {
    await expect(
      guard.canActivate(createContext({ 'x-api-key': '' }))
    ).resolves.toBe(true);
  });
});
