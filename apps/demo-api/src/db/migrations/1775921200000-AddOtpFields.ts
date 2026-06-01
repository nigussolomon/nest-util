import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpFields1775921200000 implements MigrationInterface {
  name = 'AddOtpFields1775921200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "otpCodeHash" character varying'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "otpCodeExpiresAt" TIMESTAMP WITH TIME ZONE'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "otpRequestAttempts" integer NOT NULL DEFAULT 0'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "otpLastSentAt" TIMESTAMP WITH TIME ZONE'
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "otpLockedUntil" TIMESTAMP WITH TIME ZONE'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "otpLockedUntil"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "otpLastSentAt"');
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "otpRequestAttempts"'
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "otpCodeExpiresAt"'
    );
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "otpCodeHash"');
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL'
    );
  }
}
