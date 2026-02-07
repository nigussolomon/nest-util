import {
  Controller,
  Post,
  Body,
  Inject,
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { LoginDto, RegisterDto, RefreshDto } from '../dtos/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    protected readonly authService: AuthService,
    @Inject(AUTH_OPTIONS) protected readonly options: AuthModuleOptions
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 403, description: 'Registration is disabled' })
  async register(@Body() data: any) {
    this.checkIfRouteDisabled('register');
    return await this.authService.register(data);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user and get tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() credentials: any) {
    this.checkIfRouteDisabled('login');
    return await this.authService.login(credentials);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiHeader({
    name: 'x-refresh-token',
    description: 'Refresh token passed in headers',
    required: false,
  })
  @ApiBody({ type: RefreshDto, required: false, description: 'Support token in body for backward compatibility' })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Headers() headers: Record<string, string>,
    @Body() body: { refreshToken?: string }
  ) {
    const headerName = (this.options.refreshTokenHeaderName || 'x-refresh-token').toLowerCase();
    const refreshToken = headers[headerName] || body.refreshToken;

    if (!refreshToken) {
      throw new ForbiddenException('Refresh token is required');
    }

    return await this.authService.refresh(refreshToken);
  }

  protected checkIfRouteDisabled(routeName: string) {
    if (this.options.disabledRoutes?.includes(routeName)) {
      throw new ForbiddenException(`Route /auth/${routeName} is disabled`);
    }
  }
}
