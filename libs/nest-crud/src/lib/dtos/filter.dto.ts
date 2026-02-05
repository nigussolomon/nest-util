import { IsObject, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterDto {
  @IsOptional()
  @IsObject()
  @Transform(({ obj }) => {
    const filters: Record<string, unknown> = {};

    // Iterate over all query keys (e.g., "filter[name_cont]", "page", etc.)
    Object.keys(obj).forEach((key) => {
      // Check if the key matches the pattern: filter[anything]
      const match = key.match(/^filter\[(.*)\]$/);
      if (match && match[1]) {
        filters[match[1]] = obj[key];
      }
    });

    // If we found nested filters, return them as the 'filter' property.
    // Otherwise, return the original 'filter' property if it exists.
    return Object.keys(filters).length > 0 ? filters : obj.filter;
  })
  filter?: Record<string, unknown>;
}
