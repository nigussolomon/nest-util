# Troubleshooting

Common issues and how to fix them.

## Type Errors

### TS2742: The inferred type of '...' cannot be named

**Error:**
```
The inferred type of 'UserController' cannot be named without a reference to '...'. This is likely not portable.
```

**Cause:**
TypeScript cannot determine the return type of the mixin class when generating declaration files.

**Fix:**
Explicitly implement the `IBaseController` interface in your controller.

```typescript
export class UserController extends CreateNestedCrudController(...) 
  implements IBaseController<CreateUserDto, UpdateUserDto, User> { // <--- Add this
    // ...
}
```

## Runtime Errors

### "Query parser not configured" / Filters ignored

**Symptom:**
You pass `?filter[name_eq]=john` but it returns all results.

**Cause:**
NestJS uses the default query parser which treats `filter[name_eq]` as a string key `filter[name_eq]`, not a nested object.

**Fix:**
Enable "extended" query parsing in `main.ts`.

```typescript
// main.ts
const app = await NestFactory.create(AppModule);
app.getHttpAdapter().getInstance().set('query parser', 'extended'); 
```

### "No metadata found" / "Entity not found"

**Symptom:**
TypeORM errors complaining about missing metadata.

**Cause:**
Circular dependencies between entities or incorrect imports.

**Fix:**
- Use `forwardRef(() => OtherModule)` if you have circular module dependencies.
- Ensure all entities are registered in `TypeOrmModule.forRoot({ entities: [...] })` or use `autoLoadEntities: true`.

## Build & Generator

### `ncnu` command not found

**Fix:**
Ensure you installed it globally:
```bash
npm install -g ncnu
# or
pnpm add -g ncnu
```
Or check your system PATH.

### Validation decorators not working

**Symptom:**
Invalid data is saved to the DB.

**Cause:**
Global ValidationPipe is missing or misconfigured.

**Fix:**
Add this to `main.ts`:
```typescript
app.useGlobalPipes(new ValidationPipe({ 
  transform: true, 
  enableImplicitConversion: true,
  whitelist: true 
}));
```
