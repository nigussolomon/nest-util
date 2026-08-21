import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ModificationItem } from '../interfaces/approval-pipeline.interface';

/**
 * Tracks the approval lifecycle of a created record. One row per approved-or-
 * pending entity, polymorphically referencing the target row via the table
 * name (`entity`) and its primary key (`entityId`).
 */
@Entity('approval_statuses')
export class ApprovalStatusEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Target table name, e.g. 'posts'. */
  @Index()
  @Column()
  entity!: string;

  /** Stringified primary key of the target row (works for int and uuid). */
  @Index()
  @Column()
  entityId!: string;

  /** pending | approved | rejected | modification_requested | resubmitted */
  @Index()
  @Column({ default: 'pending' })
  status!: string;

  /** User who submitted the record for approval. */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  requestedBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requestedAt!: Date;

  /** Active list of requested modifications: { field, wantedValue, ... }. */
  @Column({ type: 'jsonb', nullable: true })
  currentModifications?: ModificationItem[] | null;

  /** User who approved or rejected the record. */
  @Column({ type: 'varchar', nullable: true })
  decidedBy?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;

  /** User who resubmitted the record after modifications. */
  @Column({ type: 'varchar', nullable: true })
  resubmittedBy?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resubmittedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
