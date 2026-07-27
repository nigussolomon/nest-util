# Nest-Util Starter

A NestJS project pre-configured with `@nest-util/nest-crud` and `@nest-util/nest-auth`.

## Features

- **JWT Authentication** with token rotation (single-session enforcement)
- **OTP Login** via email
- **Password Reset** flow
- **RBAC** with permission registry
- **User CRUD** with filtering, pagination, and response DTOs
- **Audit Events** with pluggable handlers
- **Swagger** docs at `/api/docs`

## Setup

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Edit .env with your database credentials and secrets

# Start PostgreSQL (or use your own)
docker run -d --name starter-db -e POSTGRES_DB=starter_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# Start dev server
npm run start:dev
```

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login with email/password |
| POST | `/otp/request` | No | Request OTP code |
| POST | `/otp/login` | No | Login with OTP |
| POST | `/refresh` | No | Refresh access token |
| GET | `/me` | JWT | Get current user |
| POST | `/logout` | JWT | Logout (invalidate tokens) |
| POST | `/update-password` | JWT | Change password |
| POST | `/password-reset/request` | No | Request password reset |
| POST | `/password-reset/reset` | No | Reset password with token |

### Users (`/api/users`)

All endpoints require JWT authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List users (with filtering) |
| GET | `/:id` | Get user by ID |
| POST | `/` | Create user |
| PATCH | `/:id` | Update user |
| DELETE | `/:id` | Delete user |

### Swagger

Visit `http://localhost:3000/api/docs` for interactive API documentation.

## Project Structure

```
src/
├── main.ts                 # Bootstrap, Swagger, global pipes/filters
├── app.module.ts           # Root module with TypeORM, Auth, CRUD, Events
├── user/
│   ├── user.entity.ts      # User entity with all auth fields
│   ├── user.service.ts     # CRUD service with response DTO
│   ├── user.controller.ts  # CRUD endpoints (JWT protected)
│   ├── user.module.ts
│   ├── user.dto.ts         # Create/Update/Response DTOs
│   ├── role.entity.ts      # Role entity (extends RoleEntity)
│   └── user-role.entity.ts # User-Role join (extends UserRoleEntity)
└── auth/
    ├── auth.dto.ts         # Login, Register, OTP, PasswordReset DTOs
    └── permission-registry.ts  # RBAC permission definitions
```

## Adding New Resources

1. Create entity: `src/post/post.entity.ts`
2. Create DTOs: `src/post/create-post.dto.ts`, `update-post.dto.ts`
3. Create service extending `NestCrudService`
4. Create controller using `CreateNestedCrudController`
5. Register in `app.module.ts`

## Custom Audit Handlers

Replace `ConsoleHandler` with your own in `app.module.ts`:

```typescript
AuditEventModule.forRoot({
  handlers: [new PostHogHandler(), new SentryHandler()],
  include: ['auth.*', 'crud.*'],
}),
```
