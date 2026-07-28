import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1785244361283 implements MigrationInterface {
    name = 'Migrations1785244361283'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer NOT NULL, "name" character varying NOT NULL, "keyHash" character varying NOT NULL, "keyPrefix" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6c2e267ae764a9413b863a2934" ON "api_keys"  ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_6c2e267ae764a9413b863a2934"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
    }

}
