import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'stored_files' })
@Index(['ownerType', 'ownerId'])
@Index(['objectKey'], { unique: true })
export class StoredFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'varchar', length: 255 })
  contentType!: string;

  @Column({ type: 'varchar', length: 255 })
  objectKey!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'varchar', length: 255 })
  encryptionAlgorithm!: string;

  @Column({ type: 'varchar', length: 255 })
  encryptionKeyId!: string;

  @Column({ type: 'varchar', length: 24 })
  iv!: string;

  @Column({ type: 'varchar', length: 24 })
  authTag!: string;

  @Column({ type: 'varchar', length: 120 })
  digest!: string;

  @Column({ type: 'varchar', length: 120 })
  ownerType!: string;

  @Column({ type: 'varchar', length: 120 })
  ownerId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, string>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
