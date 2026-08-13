import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginAttemptFields1777000000000 implements MigrationInterface {
  name = 'AddLoginAttemptFields1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "loginAttempts" integer NOT NULL DEFAULT 0'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "loginLockedUntil" TIMESTAMP WITH TIME ZONE'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "passwordResetAttempts" integer NOT NULL DEFAULT 0'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "passwordResetLockedUntil" TIMESTAMP WITH TIME ZONE'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "passwordResetLastRequestedAt" TIMESTAMP WITH TIME ZONE'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "passwordResetLastRequestedAt"'
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "passwordResetLockedUntil"'
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "passwordResetAttempts"'
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "loginLockedUntil"'
    );
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "loginAttempts"');
  }
}
