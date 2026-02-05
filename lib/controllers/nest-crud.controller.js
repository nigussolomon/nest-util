"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNestedCrudController = CreateNestedCrudController;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const response_message_decorator_1 = require("../decorators/response-message.decorator");
function CreateNestedCrudController(createDto, updateDto, responseDto) {
    class BaseController {
        constructor(service) {
            this.service = service;
        }
        findAll(query) {
            return this.service.findAll(query);
        }
        findOne(id) {
            return this.service.findOne(id);
        }
        create(dto) {
            return this.service.create(dto);
        }
        update(id, dto) {
            return this.service.update(id, dto);
        }
        remove(id) {
            return this.service.remove(id);
        }
    }
    tslib_1.__decorate([
        (0, common_1.Get)(),
        (0, response_message_decorator_1.Message)('fetched'),
        (0, swagger_1.ApiResponse)({ type: [responseDto] }),
        (0, swagger_1.ApiQuery)({
            name: 'filter',
            required: false,
            style: 'deepObject',
            explode: true,
            type: 'object',
            description: 'Filters in format filter[field_operator]=value. Operators: eq, cont, gte, lte',
            example: { name_cont: 'Alice', isActive_eq: 'true' },
        }),
        (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
        (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
        tslib_1.__param(0, (0, common_1.Query)()),
        tslib_1.__metadata("design:type", Function),
        tslib_1.__metadata("design:paramtypes", [Object]),
        tslib_1.__metadata("design:returntype", void 0)
    ], BaseController.prototype, "findAll", null);
    tslib_1.__decorate([
        (0, common_1.Get)(':id'),
        (0, response_message_decorator_1.Message)('fetched'),
        (0, swagger_1.ApiResponse)({ type: responseDto }),
        tslib_1.__param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
        tslib_1.__metadata("design:type", Function),
        tslib_1.__metadata("design:paramtypes", [Number]),
        tslib_1.__metadata("design:returntype", void 0)
    ], BaseController.prototype, "findOne", null);
    tslib_1.__decorate([
        (0, common_1.Post)(),
        (0, response_message_decorator_1.Message)('created'),
        (0, swagger_1.ApiBody)({ type: createDto }),
        (0, swagger_1.ApiResponse)({ type: responseDto }),
        tslib_1.__param(0, (0, common_1.Body)()),
        tslib_1.__metadata("design:type", Function),
        tslib_1.__metadata("design:paramtypes", [Object]),
        tslib_1.__metadata("design:returntype", void 0)
    ], BaseController.prototype, "create", null);
    tslib_1.__decorate([
        (0, common_1.Patch)(':id'),
        (0, response_message_decorator_1.Message)('updated'),
        (0, swagger_1.ApiBody)({ type: updateDto }),
        (0, swagger_1.ApiResponse)({ type: responseDto }),
        tslib_1.__param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
        tslib_1.__param(1, (0, common_1.Body)()),
        tslib_1.__metadata("design:type", Function),
        tslib_1.__metadata("design:paramtypes", [Number, Object]),
        tslib_1.__metadata("design:returntype", void 0)
    ], BaseController.prototype, "update", null);
    tslib_1.__decorate([
        (0, common_1.Delete)(':id'),
        (0, response_message_decorator_1.Message)('deleted'),
        tslib_1.__param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
        tslib_1.__metadata("design:type", Function),
        tslib_1.__metadata("design:paramtypes", [Number]),
        tslib_1.__metadata("design:returntype", void 0)
    ], BaseController.prototype, "remove", null);
    return BaseController;
}
