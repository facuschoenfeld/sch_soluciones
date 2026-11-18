-- Versión de sesión del admin: va en el JWT (claim "tv") y se incrementa al cambiar la
-- contraseña, así los tokens emitidos antes dejan de ser válidos.
ALTER TABLE "admin_users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
