import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TypeOrmExceptionFilter } from '@nest-util/nest-crud';
import { AppModule } from './app.module';

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

  const config = new DocumentBuilder()
    .setTitle('Nest-Util Starter')
    .setDescription('API with auth, RBAC, and CRUD powered by @nest-util')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.getHttpAdapter().getInstance().set('query parser', 'extended');
  app.useGlobalFilters(new TypeOrmExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`Application running on: http://localhost:${port}/${globalPrefix}`);
  Logger.log(`Swagger docs: http://localhost:${port}/${globalPrefix}/docs`);
}

bootstrap();
