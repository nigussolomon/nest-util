import { Inject, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { NEST_FILE_OPTIONS } from '../constants';
import type { NestFileOptions } from '../interfaces/nest-file-options.interface';
import type { ImageProcessResult } from '../interfaces/nest-file-options.interface';

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  constructor(
    @Inject(NEST_FILE_OPTIONS) private readonly options: NestFileOptions
  ) {}

  async processImage(buffer: Buffer): Promise<ImageProcessResult> {
    const config = this.options.imageProcessing;
    if (!config?.enabled) {
      return {
        buffer,
        width: 0,
        height: 0,
        format: 'unknown',
        size: buffer.length,
      };
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();

    const maxWidth = config.maxWidth ?? 2048;
    const maxHeight = config.maxHeight ?? 2048;
    const quality = config.quality ?? 80;
    const format = config.format ?? 'webp';
    const stripExif = config.stripExif ?? true;

    if (stripExif) {
      image.rotate();
    }

    image.resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });

    switch (format) {
      case 'webp':
        image.webp({ quality });
        break;
      case 'avif':
        image.avif({ quality });
        break;
      case 'jpeg':
        image.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        image.png({ quality, compressionLevel: 9 });
        break;
    }

    const processedBuffer = await image.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    this.logger.log(
      `Image processed: ${metadata.width}x${metadata.height} → ${processedMetadata.width}x${processedMetadata.height} (${format})`
    );

    return {
      buffer: processedBuffer,
      width: processedMetadata.width ?? 0,
      height: processedMetadata.height ?? 0,
      format,
      size: processedBuffer.length,
    };
  }

  isProcessingEnabled(): boolean {
    return this.options.imageProcessing?.enabled ?? true;
  }
}
