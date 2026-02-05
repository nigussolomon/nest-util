"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeOrmExceptionFilter = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let TypeOrmExceptionFilter = class TypeOrmExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const driverError = exception.driverError;
        const isUniqueViolation = driverError.code === '23505' || driverError.errno === 1062;
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        if (isUniqueViolation) {
            status = common_1.HttpStatus.UNPROCESSABLE_ENTITY;
            message = 'Duplicate entry: A record with this value already exists.';
            if (driverError.detail) {
                message = driverError.detail
                    .replace('Key ', '')
                    .replace(/[()]/g, '')
                    .trim();
            }
        }
        response.status(status).json({
            status: 'error',
            message: message,
            statusCode: status,
        });
    }
};
exports.TypeOrmExceptionFilter = TypeOrmExceptionFilter;
exports.TypeOrmExceptionFilter = TypeOrmExceptionFilter = tslib_1.__decorate([
    (0, common_1.Catch)(typeorm_1.QueryFailedError)
], TypeOrmExceptionFilter);
