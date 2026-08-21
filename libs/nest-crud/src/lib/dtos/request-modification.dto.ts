import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ModificationItemDto {
  @ApiProperty({ description: 'Entity field to modify, e.g. "title"' })
  @IsString()
  field!: string;

  @ApiProperty({
    description: 'Value currently stored on the record (captured at request time)',
    required: false,
  })
  @IsOptional()
  currentValue?: unknown;

  @ApiProperty({ description: 'Value the reviewer wants instead' })
  @IsDefined()
  wantedValue!: unknown;

  @ApiProperty({ description: 'Optional explanation', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RequestModificationDto {
  @ApiProperty({
    description: 'List of requested modifications',
    type: [ModificationItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ModificationItemDto)
  modifications!: ModificationItemDto[];

  @ApiProperty({
    description: 'Optional overall note explaining the requested changes',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
