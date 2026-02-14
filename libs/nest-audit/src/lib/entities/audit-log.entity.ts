import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ nullable: true })
  tenantId?: string;

  @Index()
  @Column()
  action!: string;

  @Index()
  @Column({ nullable: true })
  entity?: string;

  @Index()
  @Column({ nullable: true })
  entityId?: string;

  @Index()
  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ nullable: true })
  ip?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
