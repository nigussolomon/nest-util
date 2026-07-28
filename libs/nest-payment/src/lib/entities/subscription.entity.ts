import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('subscriptions')
@Unique('UQ_subscriptions_provider_sub', ['provider', 'providerSubscriptionId'])
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  provider!: string;

  @Column({ nullable: true })
  providerSubscriptionId?: string;

  /** Provider's payment reference for the initial/subscription checkout */
  @Column({ nullable: true })
  providerPaymentId?: string;

  @Column({ nullable: true })
  orderId?: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ length: 3 })
  currency!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'active' | 'past_due' | 'canceled' | 'trialing';

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  customerEmail?: string;

  /** Billing interval */
  @Column({ type: 'varchar', nullable: true })
  interval?: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @Column({ type: 'int', nullable: true })
  intervalCount?: number;

  /** Current billing period start */
  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart?: Date;

  /** Current billing period end */
  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd?: Date;

  /** Whether the subscription will cancel at end of current period */
  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
