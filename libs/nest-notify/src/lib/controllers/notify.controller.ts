import {
  Body,
  Delete,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@nest-util/nest-auth';
import { NotifyService } from '../services/notify.service';
import { RegisterDeviceDto } from '../dtos/register-device.dto';
import { UnregisterDeviceDto } from '../dtos/unregister-device.dto';
import { SendPushDto } from '../dtos/send-push.dto';
import { SendEmailDto } from '../dtos/send-email.dto';
import { NotifyHistoryDto } from '../dtos/notify-history.dto';
import { AUTH_PERMISSIONS_METADATA_KEY } from '../constants';

export interface NotifyControllerOptions {
  permissions?: {
    devices?: string;
    push?: string;
    email?: string;
    history?: string;
    mine?: string;
  };
}

interface AuthUserLike {
  id: string | number;
}

export function CreateNotifyController(
  options?: NotifyControllerOptions
): abstract new (...args: any[]) => any {
  @ApiTags('notify')
  @ApiBearerAuth()
  abstract class NotifyControllerBase {
    constructor(protected readonly notifyService: NotifyService) {}

    // ─── Device tokens ───────────────────────────────────────

    @Post('devices')
    @ApiOperation({ summary: 'Register an FCM device token for the current user' })
    registerDevice(
      @CurrentUser() user: AuthUserLike,
      @Body() dto: RegisterDeviceDto
    ) {
      return this.notifyService.registerDeviceToken(
        String(user.id),
        dto.token,
        dto.platform,
        dto.deviceId
      );
    }

    @Get('devices')
    @ApiOperation({ summary: "List the current user's device tokens" })
    listDevices(@CurrentUser() user: AuthUserLike) {
      return this.notifyService.listDeviceTokens(String(user.id));
    }

    @Delete('devices')
    @ApiOperation({ summary: 'Unregister an FCM device token' })
    unregisterDevice(
      @CurrentUser() user: AuthUserLike,
      @Body() dto: UnregisterDeviceDto
    ) {
      return this.notifyService.unregisterDeviceToken(
        String(user.id),
        dto.token
      );
    }

    // ─── Push / Email ────────────────────────────────────────

    @Post('push')
    @ApiOperation({
      summary:
        'Send a push notification (defaults to the authenticated user)',
    })
    push(@CurrentUser() user: AuthUserLike, @Body() dto: SendPushDto) {
      return this.notifyService.push(dto.userId ?? String(user.id), {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        clickAction: dto.clickAction,
        data: dto.data,
      });
    }

    @Post('email')
    @ApiOperation({ summary: 'Send an email' })
    email(@CurrentUser() user: AuthUserLike, @Body() dto: SendEmailDto) {
      return this.notifyService.email(
        {
          to: dto.to,
          subject: dto.subject,
          text: dto.text,
          html: dto.html,
          cc: dto.cc,
          bcc: dto.bcc,
          replyTo: dto.replyTo,
        },
        dto.userId ?? String(user.id)
      );
    }

    // ─── History ─────────────────────────────────────────────

    @Get('history')
    @ApiOperation({ summary: "Query the current user's notification history" })
    history(@CurrentUser() user: AuthUserLike, @Query() query: NotifyHistoryDto) {
      return this.notifyService.getNotifications({
        userId: String(user.id),
        channel: query.channel,
        page: query.page,
        limit: query.limit,
      });
    }

    // ─── Mine ────────────────────────────────────────────────

    @Get('mine')
    @ApiOperation({ summary: "List the current user's notifications" })
    mine(@CurrentUser() user: AuthUserLike, @Query() query: NotifyHistoryDto) {
      return this.notifyService.getNotifications({
        userId: String(user.id),
        channel: query.channel,
        page: query.page,
        limit: query.limit,
      });
    }
  }

  if (options?.permissions) {
    const perm = options.permissions;
    if (perm.devices) {
      const deviceMethods = [
        NotifyControllerBase.prototype.registerDevice,
        NotifyControllerBase.prototype.listDevices,
        NotifyControllerBase.prototype.unregisterDevice,
      ];
      for (const method of deviceMethods) {
        Reflect.defineMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          [perm.devices],
          method
        );
      }
    }
    if (perm.push) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.push],
        NotifyControllerBase.prototype.push
      );
    }
    if (perm.email) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.email],
        NotifyControllerBase.prototype.email
      );
    }
    if (perm.history) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.history],
        NotifyControllerBase.prototype.history
      );
    }
    if (perm.mine) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.mine],
        NotifyControllerBase.prototype.mine
      );
    }
  }

  return NotifyControllerBase;
}
