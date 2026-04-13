import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { NotificationChannel, NotificationStatus } from '../interfaces/notification.interface';

@Entity({ name: 'notifications' })
@Index(['channel', 'status'])
@Index(['recipientId'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  channel!: string;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientId?: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

// Re-export types for consumers to use on the entity
export type { NotificationChannel, NotificationStatus };
