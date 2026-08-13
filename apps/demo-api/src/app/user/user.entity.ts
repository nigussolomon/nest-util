import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @Column({ select: false, nullable: true })
  password!: string;

  @Column({ select: false, nullable: true })
  refreshToken!: string;

  @Column({ select: false, nullable: true })
  accessToken!: string;

  @Column({ select: false, nullable: true })
  otpCodeHash!: string;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  otpCodeExpiresAt!: Date;

  @Column({ type: 'int', select: false, default: 0 })
  otpRequestAttempts!: number;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  otpLastSentAt!: Date;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  otpLockedUntil!: Date;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => UserRole, (userRole) => userRole.user, {
    cascade: false,
  })
  userRoles!: UserRole[];

  @Column({ select: false, nullable: true })
  passwordResetTokenHash!: string;

  @Column({
    type: 'timestamptz',
    select: false,
    nullable: true,
  })
  passwordResetTokenExpiresAt!: Date;

  @Column({ type: 'int', select: false, default: 0 })
  loginAttempts!: number;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  loginLockedUntil!: Date;

  @Column({ type: 'int', select: false, default: 0 })
  passwordResetAttempts!: number;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  passwordResetLockedUntil!: Date;

  @Column({ type: 'timestamptz', select: false, nullable: true })
  passwordResetLastRequestedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
