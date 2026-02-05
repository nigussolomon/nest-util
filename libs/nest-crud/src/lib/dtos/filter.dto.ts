import { IsObject, IsOptional } from 'class-validator';

export class FilterDto {
  @IsOptional()
  @IsObject()
  filter?: Record<string, unknown>;
}
