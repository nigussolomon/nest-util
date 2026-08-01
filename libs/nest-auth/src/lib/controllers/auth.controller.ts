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
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user';
import { AuthUser, AuthTokens } from '../interfaces/user.interface';

export function CreateAuthController(
  options: AuthModuleOptions
): Type<unknown> {
  const loginDto =
    options.loginDto ||
    class LoginDto {
      [key: string]: unknown;
    };
  const registerDto =
    options.registerDto ||
    class RegisterDto {
      [key: string]: unknown;
    };
  const refreshDto =
    options.refreshDto ||
    class RefreshDto {
      [key: string]: unknown;
    };
  const otpRequestDto =
    options.otp?.requestDto ||
    class OtpRequestDto {
      [key: string]: unknown;
    };
  const otpLoginDto =
    options.otp?.loginDto ||
    class OtpLoginDto {
      [key: string]: unknown;
    };

  const passwordResetRequestDto =
    options.passwordReset?.requestDto ||
    class PasswordResetRequestDto {
      [key: string]: unknown;
    };

  const passwordResetDto =
    options.passwordReset?.resetDto ||
    class PasswordResetDto {
      [key: string]: unknown;
    };

  const verificationRequestDto =
    options.verification?.requestDto ||
    class VerificationRequestDto {
      [key: string]: unknown;
    };

  const verificationVerifyDto =
    options.verification?.verifyDto ||
    class VerificationVerifyDto {
      [key: string]: unknown;
    };

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
    async login(
      @Body() credentials: Record<string, unknown>
    ): Promise<AuthTokens> {
      this.checkIfRouteDisabled('login');
      return await this.authService.login(credentials);
    }

    @Post('otp/request')
    @ApiOperation({ summary: 'Request one-time code for OTP login' })
    @ApiBody({ type: otpRequestDto })
    @ApiResponse({ status: 200, description: 'OTP request accepted' })
    @ApiResponse({ status: 403, description: 'OTP request route is disabled' })
    async requestOtp(@Body() data: Record<string, unknown>) {
      this.checkIfRouteDisabled('otp/request');
      return await this.authService.requestOtp(data);
    }

    @Post('otp/login')
    @ApiOperation({ summary: 'Login using one-time code' })
    @ApiBody({ type: otpLoginDto })
    @ApiResponse({ status: 200, description: 'User successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    @ApiResponse({ status: 403, description: 'OTP login route is disabled' })
    async loginWithOtp(
      @Body() credentials: Record<string, unknown>
    ): Promise<AuthTokens> {
      this.checkIfRouteDisabled('otp/login');
      return await this.authService.loginWithOtp(credentials);
    }

    @Post('verify')
    @ApiOperation({ summary: 'Verify account with OTP code' })
    @ApiBody({ type: verificationVerifyDto })
    @ApiResponse({ status: 200, description: 'Account verified, tokens returned' })
    @ApiResponse({ status: 401, description: 'Invalid or expired verification code' })
    @ApiResponse({ status: 403, description: 'Verification route is disabled' })
    async verifyAccount(
      @Body() data: Record<string, unknown>
    ): Promise<AuthTokens> {
      this.checkIfRouteDisabled('verify');
      return await this.authService.verifyAccount(data);
    }

    @Post('verify/resend')
    @ApiOperation({ summary: 'Resend verification OTP code' })
    @ApiBody({ type: verificationRequestDto })
    @ApiResponse({ status: 200, description: 'Verification code sent' })
    @ApiResponse({ status: 403, description: 'Verification route is disabled' })
    async resendVerificationCode(
      @Body() data: Record<string, unknown>
    ): Promise<{ success: boolean; message?: string }> {
      this.checkIfRouteDisabled('verify/resend');
      return await this.authService.resendVerificationCode(data);
    }

    @Post('refresh')
    @ApiOperation({ summary: 'Refresh access token using refresh token' })
    @ApiBody({
      type: refreshDto,
      required: false,
      description: 'Support token in body for backward compatibility',
    })
    @ApiResponse({ status: 200, description: 'Tokens successfully refreshed' })
    @ApiResponse({
      status: 401,
      description: 'Invalid or expired refresh token',
    })
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
    @Post('update-password')
    @ApiBearerAuth()
    @ApiBody({
      schema: {
        type: 'object',
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string' },
        },
        required: ['currentPassword', 'newPassword'],
      },
    })
    @ApiResponse({ status: 200, description: 'Password updated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid password payload' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiOperation({ summary: 'Update current user password' })
    async updatePassword(
      @CurrentUser() user: AuthUser,
      @Body() data: { currentPassword: string; newPassword: string }
    ): Promise<AuthUser> {
      await this.authService.changePassword(
        user.id,
        data.currentPassword,
        data.newPassword
      );
      return user;
    }

    @Post('password-reset/request')
    @ApiOperation({ summary: 'Request password reset token' })
    @ApiBody({ type: passwordResetRequestDto })
    @ApiResponse({
      status: 200,
      description: 'Password reset request accepted',
    })
    @ApiResponse({
      status: 403,
      description: 'Password reset request route is disabled',
    })
    async requestPasswordReset(
      @Body() data: Record<string, unknown>
    ): Promise<{ success: boolean; message?: string }> {
      this.checkIfRouteDisabled('password-reset/request');

      return await this.authService.requestPasswordReset(data);
    }

    @Post('password-reset/reset')
    @ApiOperation({ summary: 'Reset password using reset token' })
    @ApiBody({ type: passwordResetDto })
    @ApiResponse({
      status: 200,
      description: 'Password successfully reset',
    })
    @ApiResponse({
      status: 400,
      description: 'Invalid or expired reset token',
    })
    @ApiResponse({
      status: 403,
      description: 'Password reset route is disabled',
    })
    async resetPassword(
      @Body()
      data: Record<string, unknown>
    ): Promise<{ success: boolean; message: string }> {
      this.checkIfRouteDisabled('password-reset/reset');

      return await this.authService.resetPassword(
        data.token as string,
        data.newPassword as string
      );
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
