import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('refunds')
export class RefundEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  provider!: string;

  @Column()
  @Index('IDX_refunds_provider_refund_id', { unique: true })
  providerRefundId!: string;

  /** The payment this refund is for (our internal payment ID) */
  @Column()
  paymentId!: string;

  /** Provider's payment reference */
  @Column()
  providerPaymentId!: string;

  /** Refund amount in smallest currency unit */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ length: 3 })
  currency!: string;

  @Column({ nullable: true })
  reason?: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'succeeded' | 'failed';

  @Column({ nullable: true })
  idempotencyKey?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
