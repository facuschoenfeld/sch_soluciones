-- Separa la plantilla global de WhatsApp en "reserva de turno" y "consulta".
-- Se renombra (no se borra) la columna existente para conservar su contenido.
ALTER TABLE "settings" RENAME COLUMN "default_whatsapp_template" TO "booking_whatsapp_template";

-- DEFAULT temporal para poder agregar la columna NOT NULL si la tabla ya tiene la fila.
ALTER TABLE "settings" ADD COLUMN "inquiry_whatsapp_template" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ALTER COLUMN "inquiry_whatsapp_template" DROP DEFAULT;
