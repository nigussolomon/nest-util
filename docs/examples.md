# Examples & Recipes

Common patterns and advanced use cases for `nest-util`.

## 1. Soft Deletes

TypeORM supports soft deletes out of the box. To enable them with `nest-crud`, simply add the `@DeleteDateColumn` to your entity. The `remove()` method in `NestCrudService` automatically handles soft deletes if this column exists.

```typescript
// user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @DeleteDateColumn() // <--- Add this
  deletedAt?: Date;
}
```

Now, calling `DELETE /user/:id` will set `deletedAt` instead of removing the row.

## 2. Custom Business Logic

You often need to do more than just CRUD. You can override any method in your service.

**Example: Sending an email after user creation**

```typescript
// user.service.ts
@Injectable()
export class UserService extends NestCrudService<User, CreateUserDto, UpdateUserDto> {
  constructor(
    @InjectRepository(User) repo: Repository<User>,
    private mailService: MailService,
  ) {
    super({ repository: repo });
  }

  // Override the create method
  async create(dto: CreateUserDto): Promise<User> {
    // 1. Call the default implementation to save to DB
    const newUser = await super.create(dto);

    // 2. Add custom logic
    await this.mailService.sendWelcome(newUser.email);

    return newUser;
  }
}
```

## 3. Complex Filtering

`nest-crud` supports rich filtering via query parameters.

**Scenario:** Find all "active" users who joined "after 2023".

**Request:**
```http
GET /users?filter[isActive_eq]=true&filter[createdAt_gte]=2023-01-01
```

**Service Configuration:**
Make sure to whitelist these fields in your service:
```typescript
super({
    repository,
    allowedFilters: ['isActive', 'createdAt'] 
});
```

## 4. File Uploads

To handle file uploads alongside CRUD data, you can create a custom endpoint in your controller.

```typescript
// product.controller.ts
@Controller('products')
export class ProductController extends CreateNestedCrudController(...) {
  
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    // 1. Upload file to storage (S3, local, etc.)
    const imageUrl = await this.storageService.upload(file);
    
    // 2. Update the product entity
    return this.service.update(id, { imageUrl });
  }
}
```

## 5. Multiple Primary Keys / Composite Keys

Currently, `nest-crud` is optimized for single `id` primary keys. For composite keys, it is recommended to create a dedicated service and controller manually, or extend the base classes and override `findOne`, `update`, and `remove` to handle the composite ID logic (e.g., parsing a combined string like `key1_key2`).
