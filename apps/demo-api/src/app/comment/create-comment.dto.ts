import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ required: true })
  text!: string;

  @ApiProperty({ required: true })
  userId!: number;
}
