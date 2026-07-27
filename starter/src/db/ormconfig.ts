import { DataSource } from 'typeorm';
import { User } from '../user/user.entity';
import { Role } from '../user/role.entity';
import { UserRole } from '../user/user-role.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'starter_db',
  entities: [User, Role, UserRole],
  migrations: ['src/db/migrations/*.ts'],
});
