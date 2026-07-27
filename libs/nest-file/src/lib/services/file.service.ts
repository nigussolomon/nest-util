import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NEST_FILE_OPTIONS } from '../constants';
import type { NestFileOptions } from '../interfaces/nest-file-options.interface';
import { FileEntity } from '../entities/file.entity';
import { S3Service } from './s3.service';
import { ImageProcessorService } from './image-processor.service';
import { ThumbnailService } from './thumbnail.service';
import { generateStoredName, generateS3Key } from '../helpers/file-naming.helper';
import { isImageMime } from '../helpers/image-pipeline.helper';
import type { RequestUploadDto } from '../dtos/request-upload.dto';
import type { ConfirmUploadDto } from '../dtos/confirm-upload.dto';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @Inject(NEST_FILE_OPTIONS) private readonly options: NestFileOptions,
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly s3Service: S3Service,
    private readonly imageProcessor: ImageProcessorService,
    private readonly thumbnailService: ThumbnailService
  ) {}

  async requestUpload(
    dto: RequestUploadDto,
    userId: string
  ): Promise<{ uploadUrl: string; key: string; fileId: string }> {
    this.validateMimeType(dto.mimeType);

    const storedName = generateStoredName(dto.fileName);
    const key = generateS3Key(
      storedName,
      dto.folder ?? this.options.upload?.pathPrefix
    );

    const { uploadUrl } = await this.s3Service.generatePresignedUploadUrl({
      key,
      contentType: dto.mimeType,
    });

    const entity = this.fileRepository.create({
      originalName: dto.fileName,
      storedName,
      mimeType: dto.mimeType,
      size: 0,
      bucket: this.s3Service.getBucket(),
      key,
      url: '',
      userId,
    });

    const saved = await this.fileRepository.save(entity);

    this.logger.log(`Upload URL generated for file: ${saved.id}`);

    return {
      uploadUrl,
      key,
      fileId: saved.id,
    };
  }

  async confirmUpload(dto: ConfirmUploadDto): Promise<FileEntity> {
    const entity = await this.fileRepository.findOneBy({ id: dto.fileId });
    if (!entity) {
      throw new NotFoundException('File not found');
    }

    const exists = await this.s3Service.objectExists(dto.key);
    if (!exists) {
      throw new BadRequestException('File not found in storage');
    }

    let width: number | undefined;
    let height: number | undefined;
    let thumbnailUrl: string | undefined;
    let compressedSize: number | undefined;
    let compressionRatio: number | undefined;

    if (isImageMime(entity.mimeType) && this.imageProcessor.isProcessingEnabled()) {
      const downloadUrl = await this.s3Service.generatePresignedDownloadUrl(dto.key);
      const response = await fetch(downloadUrl);
      const arrayBuffer = await response.arrayBuffer();
      const originalBuffer = Buffer.from(arrayBuffer);

      const processed = await this.imageProcessor.processImage(originalBuffer);

      if (processed.buffer.length < originalBuffer.length) {
        await this.s3Service.uploadBuffer(
          dto.key,
          processed.buffer,
          `image/${processed.format}`
        );
        compressedSize = processed.buffer.length;
        compressionRatio =
          Math.round(
            (1 - processed.buffer.length / originalBuffer.length) * 100 * 100
          ) / 100;
      }

      width = processed.width;
      height = processed.height;

      if (this.thumbnailService.isThumbnailEnabled()) {
        const thumbnails = await this.thumbnailService.generateThumbnails(
          processed.buffer
        );
        if (thumbnails.length > 0) {
          const thumb = thumbnails[0];
          const thumbKey = dto.key.replace(
            /(\.[^.]+)$/,
            `-${thumb.suffix}.webp`
          );
          const thumbResult = await this.s3Service.uploadBuffer(
            thumbKey,
            thumb.buffer,
            'image/webp'
          );
          thumbnailUrl = thumbResult.url;
        }
      }
    }

    const publicUrl = this.options.s3.publicUrl
      ? `${this.options.s3.publicUrl.replace(/\/$/, '')}/${dto.key}`
      : dto.key;

    entity.url = publicUrl;
    entity.width = width;
    entity.height = height;
    entity.thumbnailUrl = thumbnailUrl;
    entity.compressedSize = compressedSize;
    entity.compressionRatio = compressionRatio;

    const saved = await this.fileRepository.save(entity);

    this.logger.log(`Upload confirmed for file: ${saved.id}`);

    return saved;
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    const entity = await this.fileRepository.findOneBy({ id: fileId });
    if (!entity) {
      throw new NotFoundException('File not found');
    }

    return this.s3Service.generatePresignedDownloadUrl(entity.key);
  }

  async getFile(fileId: string): Promise<FileEntity> {
    const entity = await this.fileRepository.findOneBy({ id: fileId });
    if (!entity) {
      throw new NotFoundException('File not found');
    }
    return entity;
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const entity = await this.fileRepository.findOneBy({ id: fileId });
    if (!entity) {
      throw new NotFoundException('File not found');
    }

    await this.s3Service.deleteObject(entity.key);

    if (entity.thumbnailUrl) {
      const thumbKey = entity.key.replace(/(\.[^.]+)$/, '-thumb.webp');
      await this.s3Service.deleteObject(thumbKey);
    }

    await this.fileRepository.remove(entity);

    this.logger.log(`File deleted: ${fileId}`);

    return true;
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  }): Promise<{ data: FileEntity[]; meta: { total: number; page: number; limit: number } }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const orderBy = query?.orderBy ?? 'createdAt';
    const orderDirection = query?.orderDirection ?? 'DESC';

    const [data, total] = await this.fileRepository.findAndCount({
      order: { [orderBy]: orderDirection },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findMine(
    userId: string,
    query?: {
      page?: number;
      limit?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    }
  ): Promise<{ data: FileEntity[]; meta: { total: number; page: number; limit: number } }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const orderBy = query?.orderBy ?? 'createdAt';
    const orderDirection = query?.orderDirection ?? 'DESC';

    const [data, total] = await this.fileRepository.findAndCount({
      where: { userId },
      order: { [orderBy]: orderDirection },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  private validateMimeType(mimeType: string): void {
    const allowed = this.options.upload?.allowedMimeTypes;
    if (!allowed || allowed.length === 0) {
      return;
    }

    const isAllowed = allowed.some((pattern) => {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.replace('/*', '');
        return mimeType.startsWith(prefix);
      }
      return mimeType === pattern;
    });

    if (!isAllowed) {
      throw new BadRequestException(
        `MIME type "${mimeType}" is not allowed. Allowed types: ${allowed.join(', ')}`
      );
    }
  }
}
