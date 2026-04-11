import 'reflect-metadata';
import {
  ALLOWED_ROLES_KEY,
  ALLOW_ANY_PERMISSION_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../constants';
import { AllowRoles } from './roles';
import { AllowAnyPermission } from './allow-any-permission';
import { RequirePermissions } from './required-permissions';

describe('RBAC decorators', () => {
  it('sets required permissions metadata', () => {
    class TestClass {
      method() {
        return true;
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestClass.prototype,
      'method'
    );
    if (!descriptor) {
      throw new Error('Descriptor not found');
    }
    RequirePermissions('posts:read', 'posts:write')(
      TestClass.prototype,
      'method',
      descriptor
    );

    expect(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, TestClass.prototype.method)
    ).toEqual(['posts:read', 'posts:write']);
  });

  it('sets allowed roles metadata', () => {
    class TestClass {}
    AllowRoles('admin', 'editor')(TestClass);

    expect(Reflect.getMetadata(ALLOWED_ROLES_KEY, TestClass)).toEqual([
      'admin',
      'editor',
    ]);
  });

  it('sets allow-any-permission metadata', () => {
    class TestClass {}
    AllowAnyPermission()(TestClass);

    expect(Reflect.getMetadata(ALLOW_ANY_PERMISSION_KEY, TestClass)).toBe(true);
  });
});
