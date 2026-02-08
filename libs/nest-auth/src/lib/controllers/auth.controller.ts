import {
  Controller,
  Post,
  Body,
  Inject,
  ForbiddenException,
  UseGuards,
  Get,
  Type,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user';
import { AuthUser, AuthTokens } from '../interfaces/user.interface';

export function CreateAuthController(options: AuthModuleOptions): Type<unknown> {
  const loginDto = options.loginDto || class LoginDto { [key: string]: unknown };
  const registerDto = options.registerDto || class RegisterDto { [key: string]: unknown };
  const refreshDto = options.refreshDto || class RefreshDto { [key: string]: unknown };

  @ApiTags('Authentication')
  @Controller('auth')
  class AuthController {
    constructor(
      protected readonly authService: AuthService,
      @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions
    ) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiBody({ type: registerDto })
    @ApiResponse({ status: 201, description: 'User successfully registered' })
    @ApiResponse({ status: 403, description: 'Registration is disabled' })
    async register(@Body() data: Record<string, unknown>): Promise<AuthUser> {
      this.checkIfRouteDisabled('register');
      return await this.authService.register(data);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login user and get tokens' })
    @ApiBody({ type: loginDto })
    @ApiResponse({ status: 200, description: 'User successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() credentials: Record<string, unknown>): Promise<AuthTokens> {
      this.checkIfRouteDisabled('login');
      return await this.authService.login(credentials);
    }

    @Post('refresh')
    @ApiOperation({ summary: 'Refresh access token using refresh token' })
    @ApiBody({ type: refreshDto, required: false, description: 'Support token in body for backward compatibility' })
    @ApiResponse({ status: 200, description: 'Tokens successfully refreshed' })
    @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
    async refresh(@Body() body: Record<string, unknown>): Promise<AuthTokens> {
      const refreshToken = body.refreshToken;

      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new ForbiddenException('Refresh token is required');
      }

      return await this.authService.refresh(refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Return current user' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
      return user;
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout user' })
    @ApiResponse({ status: 200, description: 'User successfully logged out' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async logout(@CurrentUser() user: AuthUser): Promise<boolean> {
      return await this.authService.logout(user.id);
    }

    protected checkIfRouteDisabled(routeName: string) {
      if (this.options.disabledRoutes?.includes(routeName)) {
        throw new ForbiddenException(`Route /auth/${routeName} is disabled`);
      }
    }
  }

  return AuthController;
}
