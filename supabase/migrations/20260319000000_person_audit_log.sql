-- person_audit_log: endringslogg per person
CREATE TABLE IF NOT EXISTS person_audit_log (
  id          bigserial PRIMARY KEY,
  person_id   text        NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text        NOT NULL,
  change_type text        NOT NULL,
  table_name  text,
  field_name  text,
  old_value   text,
  new_value   text,
  note        text
);

CREATE INDEX IF NOT EXISTS person_audit_log_person_idx
  ON person_audit_log(person_id);
CREATE INDEX IF NOT EXISTS person_audit_log_time_idx
  ON person_audit_log(changed_at DESC);

ALTER TABLE person_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Innloggede kan lese audit log"
  ON person_audit_log FOR SELECT
  TO authenticated
  USING (true);
