import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ required: true })
  title!: string;

  @ApiProperty({ required: true })
  content!: string;

  @ApiPropertyOptional({ example: 'draft' })
  status?: string;
}
