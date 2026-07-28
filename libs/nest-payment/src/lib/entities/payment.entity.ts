import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('payments')
@Unique('UQ_payments_provider_payment', ['provider', 'providerPaymentId'])
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Payment provider identifier (e.g. 'stripe', 'chapa') */
  @Column()
  provider!: string;

  /** Provider's unique payment/transaction reference */
  @Column({ nullable: true })
  providerPaymentId?: string;

  /** Consumer's internal order ID (optional) */
  @Column({ nullable: true })
  orderId?: string;

  /** User ID who made the payment */
  @Column({ nullable: true })
  userId?: string;

  /** Amount in smallest currency unit (cents, cents, etc.) */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  /** ISO 4217 currency code */
  @Column({ length: 3 })
  currency!: string;

  /** Payment status */
  @Column({ type: 'varchar', default: 'pending' })
  status!:
    | 'pending'
    | 'processing'
    | 'succeeded'
    | 'failed'
    | 'refunded'
    | 'canceled';

  /** Human-readable description */
  @Column({ nullable: true })
  description?: string;

  /** Customer email used for this payment */
  @Column({ nullable: true })
  customerEmail?: string;

  /** Idempotency key provided by consumer */
  @Column({ nullable: true })
  @Index('IDX_payments_idempotency_key')
  idempotencyKey?: string;

  /** Arbitrary metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
