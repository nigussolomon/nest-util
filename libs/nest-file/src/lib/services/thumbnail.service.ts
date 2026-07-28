import { Inject, Injectable, Logger } from '@nestjs/common';
import { NEST_FILE_OPTIONS } from '../constants';
import type { NestFileOptions } from '../interfaces/nest-file-options.interface';
import type { ThumbnailResult } from '../interfaces/nest-file-options.interface';
import { DEFAULT_THUMBNAIL_SIZES } from '../helpers/image-pipeline.helper';

let sharp: any;
try {
  sharp = require('sharp');
} catch {
  /* sharp not available — thumbnail generation disabled */
}

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(
    @Inject(NEST_FILE_OPTIONS) private readonly options: NestFileOptions
  ) {}

  async generateThumbnails(buffer: Buffer): Promise<ThumbnailResult[]> {
    const config = this.options.thumbnails;
    if (!config?.enabled || !sharp) {
      return [];
    }

    const sizes = config.sizes.length > 0
      ? config.sizes
      : DEFAULT_THUMBNAIL_SIZES;

    const results: ThumbnailResult[] = [];

    for (const size of sizes) {
      const thumbnailBuffer = await sharp(buffer)
        .resize({
          width: size.width,
          height: size.height,
          fit: 'cover',
        })
        .webp({ quality: 80 })
        .toBuffer();

      const metadata = await sharp(thumbnailBuffer).metadata();

      results.push({
        suffix: size.suffix,
        buffer: thumbnailBuffer,
        width: metadata.width ?? size.width,
        height: metadata.height ?? size.height,
      });

      this.logger.log(
        `Generated thumbnail: ${size.suffix} (${metadata.width}x${metadata.height})`
      );
    }

    return results;
  }

  isThumbnailEnabled(): boolean {
    return !!(this.options.thumbnails?.enabled ?? true) && !!sharp;
  }
}
