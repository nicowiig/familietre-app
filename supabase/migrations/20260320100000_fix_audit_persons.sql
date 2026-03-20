-- Fix _audit_persons trigger: fjern referanser til birth_year og death_year
-- som ikke finnes som kolonner på persons-tabellen.
-- Disse verdiene er lagret i person_facts, ikke på persons direkte.

CREATE OR REPLACE FUNCTION _audit_persons()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text; v_note text;
BEGIN
  v_op  := lower(TG_OP);
  v_pid := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;

  IF TG_OP = 'INSERT' THEN
    v_note := 'Person opprettet';
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
    VALUES (v_pid, _audit_changed_by(), v_op, 'persons', v_note);

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.sex IS DISTINCT FROM NEW.sex THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'persons', 'sex', OLD.sex, NEW.sex);
    END IF;
    IF OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'persons', 'is_deleted', OLD.is_deleted::text, NEW.is_deleted::text);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
    VALUES (v_pid, _audit_changed_by(), 'delete', 'persons', 'Person slettet');
  END IF;

  RETURN NULL;
END;
$$;
