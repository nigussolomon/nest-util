import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { ApiKeyEntity } from './api-key.entity';
import { RoleEntity } from './role.entity';

@Entity('api_key_roles')
@Index(['apiKeyId', 'roleId'], { unique: true })
export class ApiKeyRoleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  apiKeyId!: string;

  @Index()
  @Column()
  roleId!: number;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'apiKeyId' })
  apiKey!: ApiKeyEntity;

  @ManyToOne(() => RoleEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: RoleEntity;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
