-- Fix _audit_person_facts trigger: fjern referanse til OLD.value / NEW.value
-- som ikke finnes i person_facts-tabellen.
-- Legger heller til sporing av fact_type-endringer.

CREATE OR REPLACE FUNCTION _audit_person_facts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text; v_label text;
BEGIN
  v_op    := lower(TG_OP);
  v_pid   := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;
  v_label := CASE WHEN TG_OP = 'DELETE' THEN COALESCE(OLD.fact_type,'') ELSE COALESCE(NEW.fact_type,'') END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, note)
    VALUES (v_pid, _audit_changed_by(), v_op, 'person_facts', v_label, 'Hendelse lagt til');

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.fact_type IS DISTINCT FROM NEW.fact_type THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_facts', 'fact_type', OLD.fact_type, NEW.fact_type);
    END IF;
    IF OLD.date_year IS DISTINCT FROM NEW.date_year
    OR OLD.date_month IS DISTINCT FROM NEW.date_month
    OR OLD.date_day IS DISTINCT FROM NEW.date_day THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_facts', v_label || ' › dato',
        NULLIF(CONCAT_WS('-', OLD.date_year::text, OLD.date_month::text, OLD.date_day::text), '--'),
        NULLIF(CONCAT_WS('-', NEW.date_year::text, NEW.date_month::text, NEW.date_day::text), '--'));
    END IF;
    IF OLD.place_raw IS DISTINCT FROM NEW.place_raw THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_facts', v_label || ' › sted', OLD.place_raw, NEW.place_raw);
    END IF;
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, note)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_facts', v_label || ' › notat', 'Notat oppdatert');
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, note)
    VALUES (v_pid, _audit_changed_by(), 'delete', 'person_facts', v_label, 'Hendelse slettet');
  END IF;

  RETURN NULL;
END;
$$;
