import * as fs from 'fs/promises';
import * as path from 'path';
import { generate } from './generate.js';

jest.mock('fs/promises');

describe('ncnu generate', () => {
  const modelName = 'User';
  const fields = [
    'username:string',
    'age:number',
    'birthday:date',
    'password:hash',
  ];
  const targetPath = 'libs/demo-api/src/lib/resources';
  const resourceDir = path.resolve(process.cwd(), targetPath, 'user');
  const dtoDir = path.join(resourceDir, 'dtos');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the target directories including dtos folder', async () => {
    await generate(modelName, fields, targetPath);

    expect(fs.mkdir).toHaveBeenCalledWith(resourceDir, { recursive: true });
    expect(fs.mkdir).toHaveBeenCalledWith(dtoDir, { recursive: true });
  });

  it('should write all CRUD files', async () => {
    await generate(modelName, fields, targetPath);

    expect(fs.writeFile).toHaveBeenCalledTimes(5);

    const calls = (fs.writeFile as jest.Mock).mock.calls;
    const fileNames = calls.map((call) => path.basename(call[0]));

    expect(fileNames).toContain('user.entity.ts');
    expect(fileNames).toContain('create-user.dto.ts');
    expect(fileNames).toContain('update-user.dto.ts');
    expect(fileNames).toContain('user.service.ts');
    expect(fileNames).toContain('user.controller.ts');
  });

  it('should generate entity with correct TypeORM and TypeScript types', async () => {
    await generate(modelName, fields, targetPath);

    const entityCall = (fs.writeFile as jest.Mock).mock.calls.find((call) =>
      call[0].endsWith('user.entity.ts')
    );
    const content = entityCall![1];

    expect(content).toContain('export class User {');
    expect(content).toContain("@Column({ type: 'varchar', nullable: true })");
    expect(content).toContain('username!: string;');
    expect(content).toContain("@Column({ type: 'int', nullable: true })");
    expect(content).toContain('age!: number;');
    expect(content).toContain("@Column({ type: 'timestamp', nullable: true })");
    expect(content).toContain('birthday!: Date;');
    expect(content).toContain("@Column({ type: 'varchar', nullable: true })");
    expect(content).toContain('password!: string;');
    expect(content).toContain('@CreateDateColumn()');
    expect(content).toContain('@UpdateDateColumn()');
  });

  it('should generate DTOs in dtos folder with correct required flags', async () => {
    await generate(modelName, fields, targetPath);

    const createDtoCall = (fs.writeFile as jest.Mock).mock.calls.find((call) =>
      call[0].endsWith('create-user.dto.ts')
    );
    const updateDtoCall = (fs.writeFile as jest.Mock).mock.calls.find((call) =>
      call[0].endsWith('update-user.dto.ts')
    );

    const createContent = createDtoCall![1];
    const updateContent = updateDtoCall![1];

    expect(createContent).toContain('export class CreateUserDto {');
    expect(createContent).toContain('@ApiProperty({ required: true })');
    expect(createContent).toContain('username!: string;');
    expect(createContent).toContain(
      "@ApiProperty({ required: true, type: String, format: 'date-time' })"
    );
    expect(createContent).toContain('birthday!: Date;');

    expect(updateContent).toContain('export class UpdateUserDto {');
    expect(updateContent).toContain('@ApiProperty({ required: false })');
    expect(updateContent).toContain('username?: string;');
    expect(updateContent).toContain(
      "@ApiProperty({ required: false, type: String, format: 'date-time' })"
    );
    expect(updateContent).toContain('birthday?: Date;');
  });

  it('should generate service with correct DTO imports and class signature', async () => {
    await generate(modelName, fields, targetPath);

    const serviceCall = (fs.writeFile as jest.Mock).mock.calls.find((call) =>
      call[0].endsWith('user.service.ts')
    );
    const content = serviceCall![1];

    expect(content).toContain(
      'export class UserService extends NestCrudService<'
    );
    expect(content).toContain('User,');
    expect(content).toContain('CreateUserDto,');
    expect(content).toContain('UpdateUserDto');
  });

  it('should generate controller with correct imports and class signature', async () => {
    await generate(modelName, fields, targetPath);

    const controllerCall = (fs.writeFile as jest.Mock).mock.calls.find((call) =>
      call[0].endsWith('user.controller.ts')
    );
    const content = controllerCall![1];

    expect(content).toContain(
      "import { CreateNestedCrudController, IBaseController } from '@nest-util/nest-crud'"
    );
    expect(content).toContain(
      'export class UserController extends CreateNestedCrudController('
    );
    expect(content).toContain('CreateUserDto,');
    expect(content).toContain('UpdateUserDto,');
    expect(content).toContain('User');
    expect(content).toContain(
      ') implements IBaseController<CreateUserDto, UpdateUserDto, User>'
    );
    expect(content).toContain(
      'constructor(override readonly service: UserService)'
    );
  });

  it('should throw if fields array is empty', async () => {
    await expect(generate(modelName, [], targetPath)).rejects.toThrow(
      'Fields array cannot be empty'
    );
  });

  it('should handle unknown field types as string by default', async () => {
    const unknownFields = ['foo:unknown'];
    await generate('Test', unknownFields, targetPath);

    const entityCall = (fs.writeFile as jest.Mock).mock.calls.find((call) =>
      call[0].endsWith('test.entity.ts')
    );
    const content = entityCall![1];

    expect(content).toContain("@Column({ type: 'varchar', nullable: true })");
    expect(content).toContain('foo!: unknown;'); // TypeScript type stays as provided
  });
});
