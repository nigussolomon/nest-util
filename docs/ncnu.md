# `ncnu` CLI Generator

`ncnu` scaffolds complete CRUD resource files from one command, reducing startup time for new features.

## Command syntax

```bash
ncnu --gen <ModelName> --path <target-folder> <field:type> <field:type> ...
```

## Example

```bash
ncnu --gen Invoice --path apps/demo-api/src/app amount:number paid:boolean dueDate:date
```

## Supported primitive types

- `string`
- `number`
- `boolean`
- `date`

---

## Generated files

For a model named `Invoice`:

- `invoice.entity.ts`
- `create-invoice.dto.ts`
- `update-invoice.dto.ts`
- `invoice.service.ts`
- `invoice.controller.ts`

### Default behavior in generated files

- Entity columns are scaffolded with sensible defaults
- Service extends `NestCrudService`
- Controller extends `CreateNestedCrudController`
- DTOs are ready for class-validator/class-transformer extension

---

## Practical workflow

1. Generate resource with `ncnu`
2. Add relations/indexes/constraints in entity
3. Add business-specific validation in DTOs
4. Register module in app
5. Protect endpoints with `nest-auth`
6. Add tests for domain behavior

---

## Naming and structure guidance

- Use singular model names (`User`, `Project`, `Comment`)
- Keep target path within your app module tree
- Prefer one resource folder per domain aggregate

---

## Safety tips

- Do not re-run generation on heavily customized files unless you plan to merge manually
- Commit immediately after generation to keep clean diffs
- Review generated decorators before production release

For implementation details, see `libs/ncnu/src/lib/generate.ts`.
