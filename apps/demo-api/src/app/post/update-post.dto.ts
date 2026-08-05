import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePostDto {
  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  content?: string;

  @ApiPropertyOptional({ example: 'pending' })
  status?: string;
}
