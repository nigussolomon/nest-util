import * as fs from 'fs/promises';
import * as path from 'path';

interface Field {
  name: string;
  type: string;
  relation?: {
    type: 'relation' | 'relationMany';
    target: string;
  };
}

export async function generate(
  modelName: string,
  fields: string[],
  targetPath: string
) {
  if (!fields.length) throw new Error('Fields array cannot be empty');

  const parsedFields: Field[] = fields.map((f) => {
    const parts = f.split(':');
    const name = parts[0];
    const type = parts[1] ?? 'string';
    if (type.startsWith('relation')) {
      return {
        name,
        type,
        relation: {
          type: type === 'relation' ? 'relation' : 'relationMany',
          target: parts[2],
        },
      };
    }
    return { name, type };
  });

  const className = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const fileName = modelName.toLowerCase();

  const resourceDir = path.resolve(process.cwd(), targetPath, fileName);
  const dtoDir = path.join(resourceDir, 'dtos');

  await fs.mkdir(resourceDir, { recursive: true });
  await fs.mkdir(dtoDir, { recursive: true });

  const templates = {
    entity: generateEntity(className, parsedFields),
    dtoCreate: generateDto(className, parsedFields, 'Create'),
    dtoUpdate: generateDto(className, parsedFields, 'Update'),
    service: generateService(className, fileName),
    controller: generateController(className, fileName),
  };

  await Promise.all([
    fs.writeFile(
      path.join(resourceDir, `${fileName}.entity.ts`),
      templates.entity
    ),
    fs.writeFile(
      path.join(dtoDir, `create-${fileName}.dto.ts`),
      templates.dtoCreate
    ),
    fs.writeFile(
      path.join(dtoDir, `update-${fileName}.dto.ts`),
      templates.dtoUpdate
    ),
    fs.writeFile(
      path.join(resourceDir, `${fileName}.service.ts`),
      templates.service
    ),
    fs.writeFile(
      path.join(resourceDir, `${fileName}.controller.ts`),
      templates.controller
    ),
  ]);

  console.log(`Successfully generated CRUD for ${className} in ${resourceDir}`);
}

function generateEntity(className: string, fields: Field[]) {
  const imports: string[] = [
    'Entity',
    'PrimaryGeneratedColumn',
    'Column',
    'CreateDateColumn',
    'UpdateDateColumn',
  ];
  let columns = '';

  fields.forEach((f) => {
    if (f.relation) {
      if (f.relation.type === 'relation') {
        imports.push('ManyToOne', 'JoinColumn');
        columns += `\n  @ManyToOne(() => ${f.relation.target})\n  @JoinColumn()\n  ${f.name}!: ${f.relation.target};\n`;
      } else {
        imports.push('ManyToMany', 'JoinTable');
        columns += `\n  @ManyToMany(() => ${f.relation.target})\n  @JoinTable()\n  ${f.name}!: ${f.relation.target}[];\n`;
      }
    } else {
      const typeormType =
        f.type === 'string'
          ? 'varchar'
          : f.type === 'number'
          ? 'int'
          : f.type === 'date'
          ? 'timestamp'
          : 'varchar';
      const tsType =
        f.type === 'hash' ? 'string' : f.type === 'date' ? 'Date' : f.type;
      columns += `\n  @ApiProperty({ required: false })\n  @Column({ type: '${typeormType}', nullable: true })\n  ${f.name}!: ${tsType};\n`;
    }
  });

  const importSet = Array.from(new Set(imports)).join(', ');

  return `import { ${importSet} } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class ${className} {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id!: number;

  ${columns}

  @CreateDateColumn()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @UpdateDateColumn()
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
`;
}

function generateDto(
  className: string,
  fields: Field[],
  prefix: 'Create' | 'Update'
) {
  const props = fields
    .map((f) => {
      const tsType = f.relation
        ? f.relation.type === 'relation'
          ? 'number'
          : 'number[]'
        : f.type === 'hash'
        ? 'string'
        : f.type === 'date'
        ? 'Date'
        : f.type;

      const fieldName = f.relation
        ? f.relation.type === 'relation'
          ? `${f.name}Id`
          : `${f.name}Ids`
        : f.name;
      const required = prefix === 'Create';

      const apiOptions =
        tsType === 'Date'
          ? `{ required: ${required}, type: String, format: 'date-time' }`
          : `{ required: ${required} }`;

      return `  @ApiProperty(${apiOptions})\n  ${fieldName}${
        prefix === 'Update' ? '?' : '!'
      }: ${tsType};`;
    })
    .join('\n\n');

  return `import { ApiProperty } from '@nestjs/swagger';

export class ${prefix}${className}Dto {
${props}
}
`;
}

function generateService(className: string, fileName: string) {
  return `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestCrudService } from '@nest-util/nest-crud';
import { ${className} } from './${fileName}.entity';
import { Create${className}Dto } from './dtos/create-${fileName}.dto';
import { Update${className}Dto } from './dtos/update-${fileName}.dto';

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
      allowedFilters: [],
    });
  }
}
`;
}

function generateController(className: string, fileName: string) {
  return `import { Controller } from '@nestjs/common';
import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud';
import { ${className}Service } from './${fileName}.service';
import { ${className} } from './${fileName}.entity';
import { Create${className}Dto } from './dtos/create-${fileName}.dto';
import { Update${className}Dto } from './dtos/update-${fileName}.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('${fileName}')
@Controller('${fileName}')
export class ${className}Controller extends CreateNestedCrudController(
  Create${className}Dto,
  Update${className}Dto,
  ${className}
) implements IBaseController<Create${className}Dto, Update${className}Dto, ${className}> {
  constructor(override readonly service: ${className}Service) {
    super(service);
  }
}
`;
}
