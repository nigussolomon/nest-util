import { DynamicModule, Module, Controller, UseGuards, type Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from './entities/file.entity';
import { NEST_FILE_OPTIONS } from './constants';
import { NestFileOptions } from './interfaces/nest-file-options.interface';
import { S3Service } from './services/s3.service';
import { FileService } from './services/file.service';
import { CreateFileController } from './controllers/file.controller';
import { JwtAuthGuard, PermissionsGuard } from '@nest-util/nest-auth';

function buildFileController(
  options: NestFileOptions
): Type<unknown> | undefined {
  const ctrl = options.controller;
  if (ctrl?.enable === false) {
    return undefined;
  }

  const path = ctrl?.path ?? 'files';
  const ControllerBase = CreateFileController({ permissions: ctrl?.permissions });

  @Controller(path)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  class AutoFileController extends ControllerBase {
    constructor(fileService: FileService) {
      super(fileService);
    }
  }

  return AutoFileController;
}

@Module({})
export class NestFileModule {
  static forRoot(options: NestFileOptions): DynamicModule {
    const FileController = buildFileController(options);

    return {
      module: NestFileModule,
      imports: [TypeOrmModule.forFeature([FileEntity])],
      controllers: FileController ? [FileController] : [],
      providers: [
        { provide: NEST_FILE_OPTIONS, useValue: options },
        S3Service,
        FileService,
      ],
      exports: [S3Service, FileService, NEST_FILE_OPTIONS],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => NestFileOptions | Promise<NestFileOptions>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: NestFileModule,
      imports: [TypeOrmModule.forFeature([FileEntity])],
      providers: [
        {
          provide: NEST_FILE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        S3Service,
        FileService,
      ],
      exports: [S3Service, FileService, NEST_FILE_OPTIONS],
      global: true,
    };
  }
}
