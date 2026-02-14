import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  FileOwnerEntity,
  StoredFileService,
  UploadFileDto,
} from '@nest-util/nest-file';
import { JwtAuthGuard } from '@nest-util/nest-auth';
import { Audit } from '@nest-util/nest-audit';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DemoUploadFileDto } from './file.dto';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
@FileOwnerEntity('user')
export class FileController {
  constructor(private readonly fileService: StoredFileService) {}

  @Post()
  @Audit({ action: 'upload-file', entity: 'StoredFile' })
  @ApiOperation({ summary: 'Upload a base64-encoded file to encrypted storage' })
  @ApiBody({ type: DemoUploadFileDto })
  async upload(@Body() payload: DemoUploadFileDto) {
    const { contentBase64, ...input } = payload;
    const file = await this.fileService.store({
      ...(input as UploadFileDto),
      buffer: Buffer.from(contentBase64, 'base64'),
    });

    return file;
  }

  @Get(':id')
  @Audit({ action: 'get-file', entity: 'StoredFile' })
  @ApiOperation({ summary: 'Fetch and decrypt a file by id' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const file = await this.fileService.getById(id);

    return {
      ...file,
      contentBase64: file.buffer.toString('base64'),
      buffer: undefined,
    };
  }

  @Get(':ownerType/:ownerId')
  @Audit({ action: 'list-owner-files', entity: 'StoredFile' })
  @ApiOperation({ summary: 'List files for an owner' })
  async listByOwner(
    @Param('ownerType') ownerType: string,
    @Param('ownerId') ownerId: string
  ) {
    return this.fileService.listByOwner(ownerType, ownerId);
  }

  @Delete(':id')
  @Audit({ action: 'delete-file', entity: 'StoredFile' })
  @ApiOperation({ summary: 'Delete a stored file' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.fileService.remove(id);

    return { id, deleted: true };
  }
}
