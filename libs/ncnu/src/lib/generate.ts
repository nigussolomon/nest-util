import * as fs from 'fs/promises';
import * as path from 'path';

export async function generate(modelName: string, fields: string[], targetPath: string) {
  const parsedFields = fields.map(f => {
    const [name, type] = f.split(':');
    return { name, type: type || 'string' };
  });

  const className = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const fileName = modelName.toLowerCase();

  const templates = {
    entity: generateEntity(className, parsedFields),
    dtoCreate: generateDto(className, parsedFields, 'Create'),
    dtoUpdate: generateDto(className, parsedFields, 'Update'),
    service: generateService(className, fileName),
    controller: generateController(className, fileName),
  };

  const resourceDir = path.resolve(process.cwd(), targetPath, fileName);
  await fs.mkdir(resourceDir, { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(resourceDir, `${fileName}.entity.ts`), templates.entity),
    fs.writeFile(path.join(resourceDir, `create-${fileName}.dto.ts`), templates.dtoCreate),
    fs.writeFile(path.join(resourceDir, `update-${fileName}.dto.ts`), templates.dtoUpdate),
    fs.writeFile(path.join(resourceDir, `${fileName}.service.ts`), templates.service),
    fs.writeFile(path.join(resourceDir, `${fileName}.controller.ts`), templates.controller),
  ]);

  console.log(`Successfully generated CRUD for ${className} in ${resourceDir}`);
}

function generateEntity(className: string, fields: { name: string; type: string }[]) {
  const columns = fields.map(f => {
    const typeormType = f.type === 'string' ? 'varchar' : f.type === 'number' ? 'int' : (f.type === 'date' ? 'timestamp' : 'varchar');
    const tsType = f.type === 'hash' ? 'string' : (f.type === 'date' ? 'Date' : f.type);
    
    let swaggerProp = `@ApiProperty({ required: false })`;
    if (f.type === 'date') {
      swaggerProp = `@ApiProperty({ required: false, type: String, format: 'date-time' })`;
    }

    return `  ${swaggerProp}\n  @Column({ type: '${typeormType}', nullable: true })\n  ${f.name}!: ${tsType};`;
  }).join('\n\n');

  return `import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class ${className} {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id!: number;

${columns}
}
`;
}

function generateDto(className: string, fields: { name: string; type: string }[], prefix: string) {
  const properties = fields.map(f => {
    const tsType = f.type === 'hash' ? 'string' : (f.type === 'date' ? 'Date' : f.type);
    const isRequired = prefix === 'Create';
    
    let apiPropertyOptions = `required: ${isRequired}`;
    if (f.type === 'date') {
      apiPropertyOptions += `, type: String, format: 'date-time'`;
    }

    return `  @ApiProperty({ ${apiPropertyOptions} })\n  ${f.name}${prefix === 'Update' ? '?' : '!'}: ${tsType};`;
  }).join('\n\n');

  return `import { ApiProperty } from '@nestjs/swagger';

export class ${prefix}${className}Dto {
${properties}
}
`;
}

function generateService(className: string, fileName: string) {
  return `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { ${className} } from './${fileName}.entity';
import { Create${className}Dto } from './create-${fileName}.dto';
import { Update${className}Dto } from './update-${fileName}.dto';

@Injectable()
export class ${className}Service extends NestCrudService<
  ${className},
  Create${className}Dto,
  Update${className}Dto
> {
  constructor(
    @InjectRepository(${className})
    repository: Repository<${className}>,
  ) {
    super({
      repository,
      allowedFilters: [], // Add keys from ${className} to allow filtering
    });
  }
}
`;
}

function generateController(className: string, fileName: string) {
  return `import { Controller } from '@nestjs/common';
import { CreateNestedCrudController } from '@nest-util/nest-crud';
import { ${className}Service } from './${fileName}.service';
import { ${className} } from './${fileName}.entity';
import { Create${className}Dto } from './create-${fileName}.dto';
import { Update${className}Dto } from './update-${fileName}.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('${fileName}')
@Controller('${fileName}')
export class ${className}Controller extends CreateNestedCrudController(
  Create${className}Dto,
  Update${className}Dto,
  ${className}
) {
  constructor(override readonly service: ${className}Service) {
    super(service);
  }
}
`;
}
