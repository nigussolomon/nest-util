# Troubleshooting

## `filter[...]` query params not parsed correctly

Set Express query parser to extended mode:

```ts
app.getHttpAdapter().getInstance().set('query parser', 'extended');
```

## Validation decorators not transforming values

Enable transform + implicit conversion:

```ts
app.useGlobalPipes(
  new ValidationPipe({ transform: true, enableImplicitConversion: true })
);
```

## Auth login fails due to field mismatch

Verify `fieldMap` in `NestAuthModule.forRoot` matches actual entity field names.

## CLI command not found

Install globally and confirm in shell path:

```bash
pnpm add -g <ncnu-tarball>
ncnu --help
```

## GitHub Pages not updating

- Confirm deploy workflow succeeded.
- Ensure Pages source is set to GitHub Actions.
- Check that files are under `docs/`.
