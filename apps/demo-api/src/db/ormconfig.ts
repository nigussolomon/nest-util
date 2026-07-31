import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../app/user/user.entity';
import { Role } from '../app/user/role.entity';
import { UserRole } from '../app/user/user-role.entity';
import { PaymentEntity, RefundEntity, SubscriptionEntity } from '@nest-util/nest-payment';
import { ApiKeyEntity } from '@nest-util/nest-auth';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'demo',
  entities: [User, Role, UserRole, PaymentEntity, SubscriptionEntity, RefundEntity, ApiKeyEntity],
  migrations: ['src/db/migrations/*.ts'],
  synchronize: false,
});
