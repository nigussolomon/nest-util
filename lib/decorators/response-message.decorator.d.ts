export declare const MESSAGE_KEY = "customMessage";
export declare const Message: (message: string) => import("@nestjs/common").CustomDecorator<string>;
export declare const ENTITY_NAME_KEY = "entityName";
export interface EntityNames {
    singular: string;
    plural: string;
}
export declare const EntityName: (names: string | EntityNames) => import("@nestjs/common").CustomDecorator<string>;
//# sourceMappingURL=response-message.decorator.d.ts.map