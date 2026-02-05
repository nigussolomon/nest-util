"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPagination = applyPagination;
function applyPagination(qb, query) {
    const { page, limit } = query;
    if (!page || !limit) {
        return null;
    }
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);
    return {
        page,
        limit,
    };
}
