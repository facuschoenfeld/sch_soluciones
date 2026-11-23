-- Fecha de ingreso obligatoria (ordena el listado y la usan los filtros por fecha) y moneda en
-- el snapshot del servicio. Los trabajos sin fecha de ingreso toman la de alta.
UPDATE "jobs" SET "received_at" = "created_at" WHERE "received_at" IS NULL;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "service_currency_snapshot" "Currency",
ALTER COLUMN "received_at" SET NOT NULL,
ALTER COLUMN "received_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "jobs_received_at_idx" ON "jobs"("received_at");
