import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  originalName!: string;

  @Column()
  storedName!: string;

  @Column()
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column()
  bucket!: string;

  @Column()
  key!: string;

  @Column({ nullable: true })
  url?: string;

  @Column({ nullable: true })
  userId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
