import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );
  app.setGlobalPrefix(globalPrefix);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Demo API')
    .setDescription('CRUD API with NestUtil')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.getHttpAdapter().getInstance().set('query parser', 'extended');
  // LocalizedExceptionFilter is registered globally via APP_FILTER in
  // LocalizationModule (so it gets I18nService/LangResolverService injected).
  // Keep TypeOrmExceptionFilter only if other DB errors need its raw behavior.

  const port = process.env.PORT || 3008;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `🚀 Application Docs is running on: http://localhost:${port}/${globalPrefix}/docs`
  );
}

bootstrap();
