import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogCursorIndex1776000000000 implements MigrationInterface {
  name = 'AddAuditLogCursorIndex1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_cursor_pagination" 
      ON "audit_logs" ("createdAt" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_audit_logs_cursor_pagination"`
    );
  }
}
