import { Transform } from 'class-transformer';
import { IsObject, IsOptional } from 'class-validator';

export class FilterDto {
  @IsOptional()
  @IsObject()
  @Transform(({ value, obj }) => {
    // 1. If Express already parsed it into an object: { name_cont: 'Alice' }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }

    // 2. Fallback: If for some reason it's still a flat object with string keys
    // like { "filter[name_cont]": "Alice" }
    const filters: Record<string, unknown> = {};
    Object.keys(obj).forEach((key) => {
      const match = key.match(/^filter\[(.*)\]$/);
      if (match && match[1]) {
        filters[match[1]] = obj[key];
      }
    });

    return Object.keys(filters).length > 0 ? filters : value;
  })
  filter?: Record<string, unknown>;
}
