# `ncnu` CLI Generator

`ncnu` scaffolds complete CRUD resource files from a single command.

## Command shape

```bash
ncnu --gen <ModelName> --path <target-folder> <field:type> <field:type> ...
```

## Example

```bash
ncnu --gen Invoice --path apps/demo-api/src/app amount:number paid:boolean dueDate:date
```

## Supported field types

- `string`
- `number`
- `boolean`
- `date`

## What gets generated

- Entity with columns
- Create DTO
- Update DTO
- Service extending `NestCrudService`
- Controller extending `CreateNestedCrudController`

## Recommended workflow

1. Generate resource with ncnu.
2. Add relation fields and indexes manually (if needed).
3. Register module in app.
4. Protect endpoints with `nest-auth` where needed.
5. Add resource tests before production rollout.

## Tips

- Keep model names singular (`User`, `Post`, `Invoice`).
- Use generated files as a baseline, then apply domain rules.
- Re-run generation only for new resources; avoid overwriting customized files.
