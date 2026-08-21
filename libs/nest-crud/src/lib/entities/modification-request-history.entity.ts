import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import type { ModificationItem } from '../interfaces/approval-pipeline.interface';
import { ApprovalStatusEntity } from './approval-status.entity';

/**
 * Immutable record of every modification request ever made against an
 * approval status. A new row is appended each time modifications are
 * requested.
 */
@Entity('approval_modification_history')
export class ModificationRequestHistoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @ManyToOne(() => ApprovalStatusEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approvalStatusId' })
  approvalStatus!: ApprovalStatusEntity;

  @Column({ name: 'approvalStatusId' })
  approvalStatusId!: number;

  /** The requested modifications: { field, wantedValue, ... }. */
  @Column({ type: 'jsonb' })
  modifications!: ModificationItem[];

  /** User who requested the modifications. */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  requestedBy?: string | null;

  /** Optional overall note explaining the requested changes. */
  @Column({ type: 'varchar', nullable: true })
  note?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requestedAt!: Date;
}
