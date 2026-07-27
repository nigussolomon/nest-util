import {
  Body,
  Delete,
  Get,
  Param,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '@nest-util/nest-auth';
import { FileService } from '../services/file.service';
import { RequestUploadDto } from '../dtos/request-upload.dto';
import { ConfirmUploadDto } from '../dtos/confirm-upload.dto';

export const AUTH_PERMISSIONS_METADATA_KEY = 'auth:permissions';

export interface FileControllerOptions {
  permissions?: {
    upload?: string;
    download?: string;
    list?: string;
    remove?: string;
  };
}

export function CreateFileController(
  options?: FileControllerOptions
): abstract new (...args: any[]) => any {
  @ApiTags('files')
  @ApiBearerAuth()
  abstract class FileControllerBase {
    constructor(protected readonly fileService: FileService) {}

    @Post('upload-url')
    @ApiOperation({ summary: 'Request a presigned upload URL' })
    async requestUpload(
      @Body() dto: RequestUploadDto,
      @CurrentUser() user: { id: string | number }
    ) {
      return this.fileService.requestUpload(dto, String(user.id));
    }

    @Post('confirm')
    @ApiOperation({ summary: 'Confirm upload completion and process file' })
    async confirmUpload(@Body() dto: ConfirmUploadDto) {
      return this.fileService.confirmUpload(dto);
    }

    @Get(':id/download')
    @ApiOperation({ summary: 'Get presigned download URL' })
    async download(@Param('id', ParseUUIDPipe) id: string) {
      const downloadUrl = await this.fileService.getDownloadUrl(id);
      return { downloadUrl };
    }

    @Get('mine')
    @ApiOperation({ summary: 'Get current user files' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findMine(
      @CurrentUser() user: { id: string | number },
      @Query('page') page?: number,
      @Query('limit') limit?: number
    ) {
      return this.fileService.findMine(String(user.id), { page, limit });
    }

    @Get()
    @ApiOperation({ summary: 'List all files' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
      @Query('page') page?: number,
      @Query('limit') limit?: number
    ) {
      return this.fileService.findAll({ page, limit });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get file metadata' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.fileService.getFile(id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a file' })
    async remove(@Param('id', ParseUUIDPipe) id: string) {
      return this.fileService.deleteFile(id);
    }
  }

  if (options?.permissions) {
    const perm = options.permissions;
    if (perm.upload) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.upload],
        FileControllerBase.prototype.requestUpload
      );
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.upload],
        FileControllerBase.prototype.confirmUpload
      );
    }
    if (perm.download) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.download],
        FileControllerBase.prototype.download
      );
    }
    if (perm.list) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.list],
        FileControllerBase.prototype.findAll
      );
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.list],
        FileControllerBase.prototype.findMine
      );
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.list],
        FileControllerBase.prototype.findOne
      );
    }
    if (perm.remove) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.remove],
        FileControllerBase.prototype.remove
      );
    }
  }

  return FileControllerBase;
}
