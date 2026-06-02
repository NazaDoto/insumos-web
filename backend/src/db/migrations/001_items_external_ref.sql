-- Ejecutar una sola vez en bases creadas antes de esta actualización:
-- mysql -u root -p insumos_db < src/db/migrations/001_items_external_ref.sql

ALTER TABLE items
  ADD COLUMN external_ref_id VARCHAR(80) NULL
  COMMENT 'ID del sistema origen (Excel) para reimportar/actualizar'
  AFTER id;

CREATE UNIQUE INDEX ux_items_external_ref ON items (owner_type, owner_id, external_ref_id);
