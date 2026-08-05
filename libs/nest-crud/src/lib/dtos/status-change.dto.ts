import { IsDefined } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { StatusValue } from '../interfaces/status-pipeline.interface';

export class StatusChangeDto {
  @ApiProperty({
    description: 'The status value to transition to',
  })
  @IsDefined()
  status!: StatusValue;
}
