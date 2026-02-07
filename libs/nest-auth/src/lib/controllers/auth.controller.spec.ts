import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import { ForbiddenException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockOptions = {
    disabledRoutes: [] as string[],
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: AUTH_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    mockOptions.disabledRoutes = []; // reset
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register if not disabled', async () => {
      const dto = { email: 'test@test.com' };
      authService.register.mockResolvedValue({ id: 1, ...dto });

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });

    it('should throw ForbiddenException if register is disabled', async () => {
      mockOptions.disabledRoutes = ['register'];
      await expect(controller.register({})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('should call authService.login if not disabled', async () => {
      const credentials = { email: 'test@test.com' };
      authService.login.mockResolvedValue({ access_token: 'token' });

      const result = await controller.login(credentials);

      expect(authService.login).toHaveBeenCalledWith(credentials);
      expect(result).toEqual({ access_token: 'token' });
    });

    it('should throw ForbiddenException if login is disabled', async () => {
      mockOptions.disabledRoutes = ['login'];
      await expect(controller.login({})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh with token from headers', async () => {
      const headers = { 'x-refresh-token': 'header-token' };
      const body = {};
      authService.refresh.mockResolvedValue({ access_token: 'new-at' });

      const result = await controller.refresh(headers, body);

      expect(authService.refresh).toHaveBeenCalledWith('header-token');
      expect(result).toEqual({ access_token: 'new-at' });
    });

    it('should call authService.refresh with token from body if header is missing', async () => {
      const headers = {};
      const body = { refreshToken: 'body-token' };
      authService.refresh.mockResolvedValue({ access_token: 'new-at' });

      const result = await controller.refresh(headers, body);

      expect(authService.refresh).toHaveBeenCalledWith('body-token');
      expect(result).toEqual({ access_token: 'new-at' });
    });

    it('should throw ForbiddenException if token is missing entirely', async () => {
      await expect(controller.refresh({}, {})).rejects.toThrow(ForbiddenException);
    });
  });
});
