import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccessToken1770488023470 implements MigrationInterface {
    name = 'AddAccessToken1770488023470'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "accessToken" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "accessToken"`);
    }

}
