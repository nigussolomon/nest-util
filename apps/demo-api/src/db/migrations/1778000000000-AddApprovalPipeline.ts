import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalPipeline1778000000000 implements MigrationInterface {
  name = 'AddApprovalPipeline1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "approval_statuses" (
        "id" SERIAL NOT NULL,
        "entity" character varying NOT NULL,
        "entityId" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "requestedBy" character varying,
        "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "currentModifications" jsonb,
        "decidedBy" character varying,
        "decidedAt" TIMESTAMP WITH TIME ZONE,
        "resubmittedBy" character varying,
        "resubmittedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_statuses" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_approval_statuses_entity" ON "approval_statuses" ("entity")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_statuses_entityId" ON "approval_statuses" ("entityId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_statuses_status" ON "approval_statuses" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_statuses_requestedBy" ON "approval_statuses" ("requestedBy")`
    );

    await queryRunner.query(`
      CREATE TABLE "approval_modification_history" (
        "id" SERIAL NOT NULL,
        "approvalStatusId" integer NOT NULL,
        "modifications" jsonb NOT NULL,
        "requestedBy" character varying,
        "note" character varying,
        "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_modification_history" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_modification_history"
      ADD CONSTRAINT "FK_approval_modification_history_approvalStatusId"
      FOREIGN KEY ("approvalStatusId")
      REFERENCES "approval_statuses"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_modification_history_approvalStatusId" ON "approval_modification_history" ("approvalStatusId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_modification_history_requestedBy" ON "approval_modification_history" ("requestedBy")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_approval_modification_history_requestedBy"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_approval_modification_history_approvalStatusId"`
    );
    await queryRunner.query(
      `ALTER TABLE "approval_modification_history" DROP CONSTRAINT "FK_approval_modification_history_approvalStatusId"`
    );
    await queryRunner.query(`DROP TABLE "approval_modification_history"`);
    await queryRunner.query(
      `DROP INDEX "IDX_approval_statuses_requestedBy"`
    );
    await queryRunner.query(`DROP INDEX "IDX_approval_statuses_status"`);
    await queryRunner.query(`DROP INDEX "IDX_approval_statuses_entityId"`);
    await queryRunner.query(`DROP INDEX "IDX_approval_statuses_entity"`);
    await queryRunner.query(`DROP TABLE "approval_statuses"`);
  }
}
