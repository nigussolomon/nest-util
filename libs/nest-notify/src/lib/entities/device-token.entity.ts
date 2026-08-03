import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('device_tokens')
@Unique('UQ_device_tokens_token', ['token'])
export class DeviceTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Consumer's user ID who owns this device token */
  @Index('IDX_device_tokens_userId')
  @Column()
  userId!: string;

  /** FCM registration token */
  @Column()
  token!: string;

  /** Device platform */
  @Column({ type: 'varchar', default: 'web' })
  platform!: 'android' | 'ios' | 'web';

  /** Optional client-generated device identifier */
  @Column({ nullable: true })
  deviceId?: string;

  /** Last time a push was successfully delivered to this token */
  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
