-- CreateEnum
CREATE TYPE "ServiceLine" AS ENUM ('DEVELOPMENT', 'TECH_SUPPORT');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'FROM', 'QUOTE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('WHATSAPP', 'REFERRAL', 'WEB', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUOTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "line" "ServiceLine" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_type" "PriceType" NOT NULL,
    "price_amount" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "price_unit" TEXT,
    "estimated_time" TEXT,
    "whatsapp_template" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "price_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "source" "ClientSource" NOT NULL DEFAULT 'WHATSAPP',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "service_id" INTEGER,
    "service_name_snapshot" TEXT,
    "service_price_snapshot" DECIMAL(12,2),
    "service_price_type_snapshot" "PriceType",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "device_info" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'QUOTED',
    "amount_charged" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "received_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "business_name" TEXT NOT NULL,
    "tagline" TEXT,
    "whatsapp_number" TEXT NOT NULL,
    "default_whatsapp_template" TEXT NOT NULL,
    "hero_title" TEXT NOT NULL,
    "hero_subtitle" TEXT,
    "business_hours" TEXT,
    "service_area" TEXT,
    "instagram_url" TEXT,
    "github_url" TEXT,
    "linkedin_url" TEXT,
    "email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_line_is_active_idx" ON "categories"("line", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_category_id_is_active_idx" ON "services"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "clients_full_name_idx" ON "clients"("full_name");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "jobs_client_id_idx" ON "jobs"("client_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_service_id_idx" ON "jobs"("service_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones agregadas a mano (Prisma no las modela en schema.prisma).
-- Settings es una fila única.
ALTER TABLE "settings" ADD CONSTRAINT "settings_singleton" CHECK ("id" = 1);

-- Un servicio "a consultar" no tiene monto; los de precio fijo o "desde" sí.
ALTER TABLE "services" ADD CONSTRAINT "services_price_amount_matches_type"
    CHECK (("price_type" = 'QUOTE') = ("price_amount" IS NULL));
ALTER TABLE "services" ADD CONSTRAINT "services_price_amount_non_negative"
    CHECK ("price_amount" IS NULL OR "price_amount" >= 0);

-- Montos de trabajos no negativos.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_amounts_non_negative"
    CHECK ("amount_charged" >= 0 AND "amount_paid" >= 0);
