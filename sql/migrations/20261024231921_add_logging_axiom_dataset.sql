BEGIN;

-- NULL keeps the generic OTLP destination behavior for existing settings.
ALTER TABLE thermus_admin.logging_destination_settings
  ADD COLUMN axiom_dataset text;

COMMIT;
