import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  content!: string;

  @Index()
  @Column({ nullable: true })
  authorId?: number;
}
