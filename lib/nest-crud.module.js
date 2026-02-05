"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NestCrudModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const nest_crud_service_1 = require("./services/nest-crud.service");
let NestCrudModule = class NestCrudModule {
};
exports.NestCrudModule = NestCrudModule;
exports.NestCrudModule = NestCrudModule = tslib_1.__decorate([
    (0, common_1.Module)({
        providers: [nest_crud_service_1.NestCrudService],
        exports: [nest_crud_service_1.NestCrudService],
    })
], NestCrudModule);
