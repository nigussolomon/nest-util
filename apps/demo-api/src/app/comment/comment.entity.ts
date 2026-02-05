import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id!: number;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  text!: string;

  @ApiProperty({ required: false })
  @Column({ type: 'int', nullable: true })
  userId!: number;
}
