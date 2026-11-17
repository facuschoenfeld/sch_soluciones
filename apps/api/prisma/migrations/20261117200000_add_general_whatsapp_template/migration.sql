-- Plantilla de WhatsApp para contactos sin servicio puntual (botón flotante y CTA generales).
-- El DEFAULT temporal carga el texto por defecto en la fila existente (no queda vacía);
-- después se quita para que la app siempre lo envíe explícitamente.
-- Es el valor de DEFAULT_GENERAL_WHATSAPP_TEMPLATE (packages/shared) al crear la migración.
ALTER TABLE "settings" ADD COLUMN "general_whatsapp_template" TEXT NOT NULL DEFAULT '¡Hola! 👋 Vi tu página y quisiera hacerte una consulta. *Describe abajo tu consulta* ⏬';
ALTER TABLE "settings" ALTER COLUMN "general_whatsapp_template" DROP DEFAULT;
