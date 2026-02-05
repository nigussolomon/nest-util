# ncnu Generator

`ncnu` is a CLI tool that automates the creation of NestJS CRUD modules.

## Installation

Install globally from the GitHub release:

```bash
pnpm add -g https://github.com/nigussolomon/nest-util/releases/download/latest/ncnu-0.0.1.tgz
```

## Usage

Generate a complete CRUD resource with a single command:

```bash
ncnu --gen ModelName --path path/to/output field1:type field2:type
```

### Supported Field Types
- `string`: Maps to `varchar` in DB.
- `number`: Maps to `int` in DB.
- `date`: Maps to `timestamp` in DB and `Date` in TS.
- `hash`: Maps to `string` in TS.

## Features

- **Standardized DTOs**: Automatically generates `Create` and `Update` DTOs with validation placeholders.
- **Swagger Integration**: All fields are decorated with `@ApiProperty`. Date fields include proper `type` and `format` metadata.
- **Definite Assignment**: Uses the `!` operator (e.g., `name!: string`) to satisfy strict initialization checks.
- **Folder Organization**: Automatically creates a dedicated folder for the model with all necessary files (entity, service, controller, DTOs).
