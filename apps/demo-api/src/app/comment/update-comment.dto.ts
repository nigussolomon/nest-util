import { ApiProperty } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiProperty({ required: false })
  text?: string;

  @ApiProperty({ required: false })
  userId?: number;
}
