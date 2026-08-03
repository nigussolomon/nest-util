import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('onboarding_attempts')
@Index(
  'idx_onboarding_attempts_pending',
  ['identifierField', 'identifier'],
  { unique: true, where: `"consumedAt" IS NULL` }
)
export class OnboardingAttemptEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Which identifier field the OTP was delivered to (e.g. 'email', 'phone').
   */
  @Column()
  identifierField!: string;

  /**
   * The identifier value the OTP was delivered to.
   */
  @Column()
  identifier!: string;

  @Column({ select: false, nullable: true })
  codeHash?: string;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  codeExpiresAt?: Date;

  @Column({ type: 'int', select: false, default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  lastSentAt?: Date;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  lockedUntil?: Date;

  /**
   * Set when the onboarding token is issued (step complete) or the user is
   * created. A consumed attempt can never issue or validate a token again.
   */
  @Column({ type: 'timestamptz', nullable: true })
  consumedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
