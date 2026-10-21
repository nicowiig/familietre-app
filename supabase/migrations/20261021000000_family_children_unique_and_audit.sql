-- ============================================================
-- Unik barnekobling + endringslogg for families/family_children
-- Allerede kjørt mot prod 2026-10-21 (migrering
-- family_children_unique_and_family_audit). Lagt inn her for sporbarhet.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_children_family_child
  ON public.family_children (family_id, child_id);

CREATE OR REPLACE FUNCTION public._audit_families()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE r record; v_pid text;
BEGIN
  BEGIN
    r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    v_pid := COALESCE(r.husband_id, r.wife_id, OLD.husband_id, OLD.wife_id, r.family_id);
    IF TG_OP = 'INSERT' THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, new_value, note)
      VALUES (v_pid, _audit_changed_by(), 'insert', 'families', r.family_id,
              CONCAT_WS('/', NEW.husband_id, NEW.wife_id), 'Familie opprettet');
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.husband_id IS DISTINCT FROM NEW.husband_id THEN
        INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
        VALUES (COALESCE(OLD.husband_id, NEW.husband_id, v_pid), _audit_changed_by(), 'update', 'families', 'husband_id', OLD.husband_id, NEW.husband_id, 'Familie ' || NEW.family_id);
      END IF;
      IF OLD.wife_id IS DISTINCT FROM NEW.wife_id THEN
        INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
        VALUES (COALESCE(OLD.wife_id, NEW.wife_id, v_pid), _audit_changed_by(), 'update', 'families', 'wife_id', OLD.wife_id, NEW.wife_id, 'Familie ' || NEW.family_id);
      END IF;
      IF OLD.marr_date IS DISTINCT FROM NEW.marr_date OR OLD.marr_place_raw IS DISTINCT FROM NEW.marr_place_raw
         OR OLD.div_date IS DISTINCT FROM NEW.div_date OR OLD.family_type IS DISTINCT FROM NEW.family_type THEN
        INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, note)
        VALUES (v_pid, _audit_changed_by(), 'update', 'families', 'ekteskapsdata', 'Familie ' || NEW.family_id || ' oppdatert');
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, note)
      VALUES (v_pid, _audit_changed_by(), 'delete', 'families', OLD.family_id,
              CONCAT_WS('/', OLD.husband_id, OLD.wife_id), 'Familie slettet');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit families feilet: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public._audit_family_children()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, new_value, note)
      VALUES (NEW.child_id, _audit_changed_by(), 'insert', 'family_children', 'family_id', NEW.family_id, 'Koblet som barn i familie');
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.family_id IS DISTINCT FROM NEW.family_id OR OLD.child_id IS DISTINCT FROM NEW.child_id THEN
        INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
        VALUES (COALESCE(NEW.child_id, OLD.child_id), _audit_changed_by(), 'update', 'family_children', 'family_id/child_id',
                OLD.family_id || '/' || OLD.child_id, NEW.family_id || '/' || NEW.child_id, 'Barnekobling endret');
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, note)
      VALUES (OLD.child_id, _audit_changed_by(), 'delete', 'family_children', 'family_id', OLD.family_id, 'Fjernet som barn fra familie');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit family_children feilet: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS audit_families ON public.families;
CREATE TRIGGER audit_families AFTER INSERT OR UPDATE OR DELETE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public._audit_families();

DROP TRIGGER IF EXISTS audit_family_children ON public.family_children;
CREATE TRIGGER audit_family_children AFTER INSERT OR UPDATE OR DELETE ON public.family_children
  FOR EACH ROW EXECUTE FUNCTION public._audit_family_children();
