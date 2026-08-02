import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyService } from './services/api-key.service';
import { AuthModule } from './auth.module';
import type { AuthModuleOptions } from './interfaces/auth-options';

function buildOptions(apiKeyEnabled: boolean): AuthModuleOptions {
  return {
    userEntity: class User {
      id = 1;
    },
    identifierField: 'email',
    passkeyField: 'password',
    jwtSecret: 'test-secret',
    disabledRoutes: [],
    permissionRegistry: {
      resources: [{ resource: 'users', permissions: ['read', 'manage'] }],
    },
    apiKey: apiKeyEnabled ? { enabled: true } : { enabled: false },
  };
}

function paramTypes(cls: object): unknown[] {
  return Reflect.getMetadata('design:paramtypes', cls) ?? [];
}

describe('AuthModule apiKey wiring', () => {
  it('does not register the api-keys controller or providers when apiKey is disabled', () => {
    const mod = AuthModule.forRoot(buildOptions(false));
    const controllers = mod.controllers as unknown[];

    expect(controllers.length).toBe(4);
    for (const controller of controllers) {
      expect(paramTypes(controller as object)).not.toContain(ApiKeyService);
    }

    expect(mod.providers).not.toContain(ApiKeyService);
    expect(mod.providers).not.toContain(ApiKeyGuard);
  });

  it('registers the api-keys controller and providers when apiKey is enabled', () => {
    const mod = AuthModule.forRoot(buildOptions(true));
    const controllers = mod.controllers as unknown[];

    expect(controllers.length).toBe(5);
    expect(
      controllers.some((c) => paramTypes(c as object).includes(ApiKeyService))
    ).toBe(true);

    expect(mod.providers).toContain(ApiKeyService);
    expect(mod.providers).toContain(ApiKeyGuard);
  });
});
