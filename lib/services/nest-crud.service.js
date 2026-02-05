"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NestCrudService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const filter_helper_1 = require("../helpers/filter.helper");
const pagination_helper_1 = require("../helpers/pagination.helper");
let NestCrudService = class NestCrudService {
    constructor(options) {
        this.repo = options.repository;
        this.allowedFilters = options.allowedFilters ?? [];
        this.toResponseDto = options.toResponseDto;
        this.createDtoClass = options.createDtoClass;
        this.updateDtoClass = options.updateDtoClass;
    }
    async findAll(query) {
        const qb = this.repo.createQueryBuilder('e');
        (0, filter_helper_1.applyFilters)(qb, query.filter, this.allowedFilters);
        const paginationMeta = (0, pagination_helper_1.applyPagination)(qb, query);
        const [entities, total] = await qb.getManyAndCount();
        const data = this.toResponseDto
            ? this.toResponseDto(entities)
            : entities;
        return paginationMeta
            ? { data, meta: { ...paginationMeta, total } }
            : { data };
    }
    async findOne(id) {
        const entity = await this.repo.findOneBy({ id });
        if (!entity) {
            throw new common_1.NotFoundException('Resource not found');
        }
        return this.toResponseDto
            ? this.toResponseDto(entity)
            : entity;
    }
    async create(payload) {
        const entity = await this.repo.save(payload);
        return this.toResponseDto
            ? this.toResponseDto(entity)
            : entity;
    }
    async update(id, payload) {
        const existing = await this.repo.findOneBy({ id });
        if (!existing) {
            throw new common_1.NotFoundException('Resource not found');
        }
        await this.repo.update(id, payload);
        return this.findOne(id);
    }
    async remove(id) {
        const result = await this.repo.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException('Resource not found');
        }
        return true;
    }
};
exports.NestCrudService = NestCrudService;
exports.NestCrudService = NestCrudService = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [Object])
], NestCrudService);
