"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterDto = void 0;
const tslib_1 = require("tslib");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class FilterDto {
}
exports.FilterDto = FilterDto;
tslib_1.__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => {
        // 1. If Express already parsed it into an object: { name_cont: 'Alice' }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        // 2. Fallback: If for some reason it's still a flat object with string keys
        // like { "filter[name_cont]": "Alice" }
        const filters = {};
        Object.keys(obj).forEach((key) => {
            const match = key.match(/^filter\[(.*)\]$/);
            if (match && match[1]) {
                filters[match[1]] = obj[key];
            }
        });
        return Object.keys(filters).length > 0 ? filters : value;
    }),
    tslib_1.__metadata("design:type", Object)
], FilterDto.prototype, "filter", void 0);
