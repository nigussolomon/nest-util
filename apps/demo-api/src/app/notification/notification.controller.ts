import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ListNotificationsDto,
  NotificationService,
  SendNotificationDto,
} from '@nest-util/nest-notification';
import { JwtAuthGuard } from '@nest-util/nest-auth';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Send a mail or webhook notification' })
  async send(@Body() dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications with optional filters' })
  async findAll(@Query() query: ListNotificationsDto) {
    return this.notificationService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.findById(id);
  }
}
