import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Recipient user ID (nullable for ad-hoc sends) */
  @Index('IDX_notifications_userId')
  @Column({ nullable: true })
  userId?: string;

  /** Notification channel */
  @Column({ type: 'varchar' })
  channel!: 'push' | 'email';

  /** Underlying provider */
  @Column({ type: 'varchar' })
  provider!: 'fcm' | 'smtp';

  /** Delivery outcome */
  @Column({ type: 'varchar', default: 'sent' })
  status!: 'sent' | 'failed';

  /** Push title / email subject */
  @Column({ nullable: true })
  title?: string;

  /** Push body / email text summary */
  @Column({ nullable: true, type: 'text' })
  body?: string;

  /** Email subject (same as title for push) */
  @Column({ nullable: true })
  subject?: string;

  /** Email recipient or device token this was delivered to */
  @Column({ nullable: true })
  to?: string;

  /** Error message when the send failed */
  @Column({ nullable: true, type: 'text' })
  error?: string;

  /** Arbitrary metadata (e.g. notification type, deep link) */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /** When the notification was sent (or attempted) */
  @Column({ type: 'timestamptz' })
  sentAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
