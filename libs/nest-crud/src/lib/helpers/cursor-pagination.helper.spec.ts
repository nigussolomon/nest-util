import {
  base64UrlEncode,
  base64UrlDecode,
  decodeCursor,
  applyCursorFilter,
  buildNextCursor,
  detectCursorStrategy,
} from './cursor-pagination.helper';
import {
  CursorStrategy,
  DecodedCursor,
} from '../interfaces/cursor-strategy.interface';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('cursor-pagination.helper', () => {
  describe('base64UrlEncode / base64UrlDecode', () => {
    it('should round-trip a simple object', () => {
      const payload = { id: 42 };
      const encoded = base64UrlEncode(payload);
      const decoded = base64UrlDecode(encoded);
      expect(decoded).toEqual(payload);
    });

    it('should produce URL-safe characters only', () => {
      const payload = { id: 42, name: 'hello world?' };
      const encoded = base64UrlEncode(payload);
      expect(encoded).not.toMatch(/[+/=]/);
    });

    it('should handle UUID-style values', () => {
      const payload = {
        createdAt: '2026-07-24T10:30:00.000Z',
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      };
      const encoded = base64UrlEncode(payload);
      const decoded = base64UrlDecode(encoded);
      expect(decoded).toEqual(payload);
    });
  });

  describe('decodeCursor', () => {
    const integerStrategy: CursorStrategy = { type: 'integer' };
    const uuidStrategy: CursorStrategy = {
      type: 'uuid',
      timestampColumn: 'createdAt',
    };

    it('should decode integer cursor', () => {
      const cursor = base64UrlEncode({ id: 42 });
      const decoded = decodeCursor(cursor, integerStrategy);
      expect(decoded).toEqual({ type: 'integer', id: 42 });
    });

    it('should decode UUID composite cursor', () => {
      const cursor = base64UrlEncode({
        createdAt: '2026-07-24T10:30:00.000Z',
        id: 'abc-123',
      });
      const decoded = decodeCursor(cursor, uuidStrategy);
      expect(decoded).toEqual({
        type: 'uuid',
        createdAt: '2026-07-24T10:30:00.000Z',
        id: 'abc-123',
      });
    });

    it('should throw on invalid base64', () => {
      expect(() => decodeCursor('!!!invalid!!!', integerStrategy)).toThrow(
        'Invalid cursor format'
      );
    });

    it('should throw on missing id for integer strategy', () => {
      const cursor = base64UrlEncode({ something: 'else' });
      expect(() => decodeCursor(cursor, integerStrategy)).toThrow(
        'Invalid integer cursor'
      );
    });

    it('should throw on missing fields for UUID strategy', () => {
      const cursor = base64UrlEncode({ something: 'else' });
      expect(() => decodeCursor(cursor, uuidStrategy)).toThrow(
        'Invalid UUID cursor'
      );
    });
  });

  describe('applyCursorFilter', () => {
    it('should apply integer cursor filter for DESC', () => {
      const qb = {
        expressionMap: { mainAlias: { name: 'e' } },
        andWhere: jest.fn(),
      } as any;

      const decoded: DecodedCursor = { type: 'integer', id: 42 };
      applyCursorFilter(qb, decoded, { type: 'integer' }, 'DESC');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'e.id < :cursorId',
        { cursorId: 42 }
      );
    });

    it('should apply integer cursor filter for ASC', () => {
      const qb = {
        expressionMap: { mainAlias: { name: 'e' } },
        andWhere: jest.fn(),
      } as any;

      const decoded: DecodedCursor = { type: 'integer', id: 42 };
      applyCursorFilter(qb, decoded, { type: 'integer' }, 'ASC');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'e.id > :cursorId',
        { cursorId: 42 }
      );
    });

    it('should apply UUID composite cursor filter', () => {
      const qb = {
        expressionMap: { mainAlias: { name: 'auditLog' } },
        andWhere: jest.fn(),
      } as any;

      const decoded: DecodedCursor = {
        type: 'uuid',
        createdAt: '2026-07-24T10:30:00.000Z',
        id: 'abc-123',
      };
      applyCursorFilter(
        qb,
        decoded,
        { type: 'uuid', timestampColumn: 'createdAt' },
        'DESC'
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(auditLog.createdAt, auditLog.id) < (:cursorTs, :cursorId)',
        { cursorTs: '2026-07-24T10:30:00.000Z', cursorId: 'abc-123' }
      );
    });
  });

  describe('buildNextCursor', () => {
    const integerStrategy: CursorStrategy = { type: 'integer' };
    const uuidStrategy: CursorStrategy = {
      type: 'uuid',
      timestampColumn: 'createdAt',
    };

    it('should return null for empty array', () => {
      expect(buildNextCursor([], integerStrategy)).toBeNull();
    });

    it('should build integer cursor from last entity', () => {
      const entities = [{ id: 1 }, { id: 2 }, { id: 10 }];
      const cursor = buildNextCursor(entities, integerStrategy);
      expect(cursor).toBe(base64UrlEncode({ id: 10 }));
    });

    it('should build UUID cursor from last entity', () => {
      const entities = [
        { id: 'a', createdAt: '2026-07-24T10:00:00Z' },
        { id: 'b', createdAt: '2026-07-24T10:30:00Z' },
      ];
      const cursor = buildNextCursor(entities, uuidStrategy);
      expect(cursor).toBe(
        base64UrlEncode({
          createdAt: '2026-07-24T10:30:00Z',
          id: 'b',
        })
      );
    });
  });

  describe('detectCursorStrategy', () => {
    it('should return integer strategy for integer PK', () => {
      const repo = {
        metadata: {
          primaryColumns: [{ type: Number }],
        },
      } as any;
      expect(detectCursorStrategy(repo)).toEqual({ type: 'integer' });
    });

    it('should return uuid strategy for string PK', () => {
      const repo = {
        metadata: {
          primaryColumns: [{ type: String }],
        },
      } as any;
      expect(detectCursorStrategy(repo)).toEqual({ type: 'uuid' });
    });

    it('should default to integer when no primary column', () => {
      const repo = {
        metadata: {
          primaryColumns: [],
        },
      } as any;
      expect(detectCursorStrategy(repo)).toEqual({ type: 'integer' });
    });
  });
});
