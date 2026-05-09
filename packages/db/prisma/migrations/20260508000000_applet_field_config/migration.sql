-- Add field_config column to applets table.
-- Stores a JSONB array of FieldDef objects describing the widget form layout.
-- NULL means the applet uses the default field set.
ALTER TABLE "applets" ADD COLUMN IF NOT EXISTS "field_config" JSONB;
