import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FILE_MODULE_OPTIONS } from './constants/file.constants';
import { StoredFileEntity } from './entities/stored-file.entity';
import {
  FileModuleAsyncOptions,
  FileModuleOptions,
  FileModuleOptionsFactory,
} from './interfaces/file-module-options.interface';
import { FileEncryptionService } from './services/file-encryption.service';
import { StoredFileService } from './services/stored-file.service';

@Module({})
export class NestFileModule {
  static forRoot(options: FileModuleOptions): DynamicModule {
    return {
      module: NestFileModule,
      imports: [TypeOrmModule.forFeature([StoredFileEntity])],
      providers: [
        { provide: FILE_MODULE_OPTIONS, useValue: options },
        FileEncryptionService,
        StoredFileService,
      ],
      exports: [StoredFileService, TypeOrmModule],
    };
  }

  static forRootAsync(options: FileModuleAsyncOptions): DynamicModule {
    return {
      module: NestFileModule,
      imports: [...(options.imports ?? []), TypeOrmModule.forFeature([StoredFileEntity])],
      providers: [
        ...this.createAsyncProviders(options),
        FileEncryptionService,
        StoredFileService,
      ],
      exports: [StoredFileService, TypeOrmModule],
    };
  }

  private static createAsyncProviders(options: FileModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: FILE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    const useClass = options.useClass ?? options.useExisting;

    if (!useClass) {
      throw new Error('forRootAsync requires useFactory, useClass, or useExisting');
    }

    return [
      {
        provide: FILE_MODULE_OPTIONS,
        useFactory: async (factory: FileModuleOptionsFactory) =>
          factory.createFileModuleOptions(),
        inject: [useClass],
      },
      ...(options.useClass
        ? [{ provide: useClass, useClass: options.useClass }]
        : []),
    ];
  }
}
