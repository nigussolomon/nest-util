import * as fs from 'fs/promises';
import * as path from 'path';
import { generate } from './generate';

jest.mock('fs/promises');

describe('ncnu generate', () => {
  const modelName = 'User';
  const fields = ['username:string', 'age:number', 'birthday:date', 'password:hash'];
  const targetPath = 'libs/demo-api/src/lib/resources';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the target directory', async () => {
    await generate(modelName, fields, targetPath);
    
    expect(fs.mkdir).toHaveBeenCalledWith(
      path.resolve(process.cwd(), targetPath, 'user'),
      { recursive: true }
    );
  });

  it('should write all 5 CRUD files', async () => {
    await generate(modelName, fields, targetPath);
    
    expect(fs.writeFile).toHaveBeenCalledTimes(5);
    
    const calls = (fs.writeFile as jest.Mock).mock.calls;
    const fileNames = calls.map(call => path.basename(call[0]));
    
    expect(fileNames).toContain('user.entity.ts');
    expect(fileNames).toContain('create-user.dto.ts');
    expect(fileNames).toContain('update-user.dto.ts');
    expect(fileNames).toContain('user.service.ts');
    expect(fileNames).toContain('user.controller.ts');
  });

  it('should generate correct entity content with various field types', async () => {
    await generate(modelName, fields, targetPath);
    
    const entityCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
      call[0].endsWith('user.entity.ts')
    );
    const content = entityCall[1];

    expect(content).toContain('export class User {');
    expect(content).toContain('@Column({ type: \'varchar\', nullable: true })');
    expect(content).toContain('username!: string;');
    expect(content).toContain('@Column({ type: \'int\', nullable: true })');
    expect(content).toContain('age!: number;');
    expect(content).toContain('@Column({ type: \'timestamp\', nullable: true })');
    expect(content).toContain('birthday!: Date;');
    expect(content).toContain('password!: string;');
  });

  it('should generate correct DTO content', async () => {
    await generate(modelName, fields, targetPath);
    
    const createDtoCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
      call[0].endsWith('create-user.dto.ts')
    );
    const content = createDtoCall[1];

    expect(content).toContain('export class CreateUserDto {');
    expect(content).toContain('@ApiProperty({ required: true })');
    expect(content).toContain('username!: string;');
    expect(content).toContain('@ApiProperty({ required: true, type: String, format: \'date-time\' })');
    expect(content).toContain('birthday!: Date;');
  });

  it('should generate correct service content', async () => {
    await generate(modelName, fields, targetPath);
    
    const serviceCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
      call[0].endsWith('user.service.ts')
    );
    const content = serviceCall[1];

    expect(content).toContain('export class UserService extends NestCrudService<');
    expect(content).toContain('User,');
    expect(content).toContain('CreateUserDto,');
    expect(content).toContain('UpdateUserDto');
  });

  it('should generate correct controller content', async () => {
    await generate(modelName, fields, targetPath);
    
    const controllerCall = (fs.writeFile as jest.Mock).mock.calls.find(call => 
      call[0].endsWith('user.controller.ts')
    );
    const content = controllerCall[1];

    expect(content).toContain('export class UserController extends CreateNestedCrudController(');
    expect(content).toContain('CreateUserDto,');
    expect(content).toContain('UpdateUserDto,');
    expect(content).toContain('User');
    expect(content).toContain('constructor(override readonly service: UserService)');
  });
});
