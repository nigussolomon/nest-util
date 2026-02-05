"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseInterceptor = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const core_1 = require("@nestjs/core");
const response_message_decorator_1 = require("../decorators/response-message.decorator");
let ResponseInterceptor = class ResponseInterceptor {
    constructor(reflector) {
        this.reflector = reflector;
    }
    intercept(context, next) {
        const handler = context.getHandler();
        const controller = context.getClass();
        return next.handle().pipe((0, operators_1.map)((data) => {
            const entityConfig = this.reflector.get(response_message_decorator_1.ENTITY_NAME_KEY, controller);
            const action = this.reflector.get(response_message_decorator_1.MESSAGE_KEY, handler);
            const isList = Array.isArray(data) || Array.isArray(data?.data);
            const name = isList
                ? entityConfig?.plural ?? 'Resources'
                : entityConfig?.singular ?? 'Resource';
            const finalMessage = action
                ? `${name} ${action} successfully`
                : 'Request successful';
            return {
                message: finalMessage,
                data: data?.data ?? data ?? null,
                meta: data?.meta,
                status: 'success',
            };
        }));
    }
};
exports.ResponseInterceptor = ResponseInterceptor;
exports.ResponseInterceptor = ResponseInterceptor = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [core_1.Reflector])
], ResponseInterceptor);
