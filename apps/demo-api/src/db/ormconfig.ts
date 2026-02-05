import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../app/user/user.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'demo_user',
  password: process.env.DB_PASSWORD || 'demo_pass',
  database: process.env.DB_NAME || 'demo_db',
  entities: [User],
  migrations: ['src/db/migrations/*.ts'],
  synchronize: false,
  entitySkipConstructor: true,
});
