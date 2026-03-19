-- ============================================================
-- Audit log triggers: automatisk logging av endringer
--
-- Tabeller dekket:
--   persons, person_names, person_facts, person_biography,
--   person_roles, person_work_experience, person_sources,
--   address_periods
--
-- changed_by: auth.email() → auth.uid()::text → 'script'
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- Hjelpefunksjon: hvem gjør endringen?
-- (auth.email() er NULL ved service-key-kall → bruker 'script')
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_changed_by()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.email(),
    auth.uid()::text,
    'script'
  );
$$;


-- ────────────────────────────────────────────────────────────
-- persons
-- ────────────────────────────────────────────────────────────
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
    -- sex
    IF OLD.sex IS DISTINCT FROM NEW.sex THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'persons', 'sex', OLD.sex, NEW.sex);
    END IF;
    -- birth_year
    IF OLD.birth_year IS DISTINCT FROM NEW.birth_year THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'persons', 'birth_year', OLD.birth_year::text, NEW.birth_year::text);
    END IF;
    -- death_year
    IF OLD.death_year IS DISTINCT FROM NEW.death_year THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'persons', 'death_year', OLD.death_year::text, NEW.death_year::text);
    END IF;
    -- is_deleted
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

DROP TRIGGER IF EXISTS audit_persons ON persons;
CREATE TRIGGER audit_persons
  AFTER INSERT OR UPDATE OR DELETE ON persons
  FOR EACH ROW EXECUTE FUNCTION _audit_persons();


-- ────────────────────────────────────────────────────────────
-- person_names
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_person_names()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text;
BEGIN
  v_op  := lower(TG_OP);
  v_pid := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
    VALUES (v_pid, _audit_changed_by(), v_op, 'person_names',
      'Navn lagt til: ' || COALESCE(TRIM(COALESCE(NEW.given_name,'') || ' ' || COALESCE(NEW.surname,'')), ''));

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.given_name IS DISTINCT FROM NEW.given_name THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_names', 'given_name', OLD.given_name, NEW.given_name);
    END IF;
    IF OLD.surname IS DISTINCT FROM NEW.surname THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_names', 'surname', OLD.surname, NEW.surname);
    END IF;
    IF OLD.nickname IS DISTINCT FROM NEW.nickname THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_names', 'nickname', OLD.nickname, NEW.nickname);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
    VALUES (v_pid, _audit_changed_by(), 'delete', 'person_names',
      'Navn slettet: ' || COALESCE(TRIM(COALESCE(OLD.given_name,'') || ' ' || COALESCE(OLD.surname,'')), ''));
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_person_names ON person_names;
CREATE TRIGGER audit_person_names
  AFTER INSERT OR UPDATE OR DELETE ON person_names
  FOR EACH ROW EXECUTE FUNCTION _audit_person_names();


-- ────────────────────────────────────────────────────────────
-- person_facts (hendelser: fødsel, død, vigsel, etc.)
-- ────────────────────────────────────────────────────────────
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
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value)
      VALUES (v_pid, _audit_changed_by(), 'update', 'person_facts', v_label || ' › verdi', OLD.value, NEW.value);
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

DROP TRIGGER IF EXISTS audit_person_facts ON person_facts;
CREATE TRIGGER audit_person_facts
  AFTER INSERT OR UPDATE OR DELETE ON person_facts
  FOR EACH ROW EXECUTE FUNCTION _audit_person_facts();


-- ────────────────────────────────────────────────────────────
-- person_biography
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_person_biography()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text;
BEGIN
  v_op  := lower(TG_OP);
  v_pid := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;

  INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  VALUES (v_pid, _audit_changed_by(), v_op, 'person_biography',
    CASE TG_OP
      WHEN 'INSERT' THEN 'Biografi lagt til'
      WHEN 'UPDATE' THEN 'Biografi oppdatert'
      WHEN 'DELETE' THEN 'Biografi slettet'
    END);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_person_biography ON person_biography;
CREATE TRIGGER audit_person_biography
  AFTER INSERT OR UPDATE OR DELETE ON person_biography
  FOR EACH ROW EXECUTE FUNCTION _audit_person_biography();


-- ────────────────────────────────────────────────────────────
-- person_roles (karriere, utdanning, politiske verv, etc.)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_person_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text; v_label text;
BEGIN
  v_op    := lower(TG_OP);
  v_pid   := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;
  v_label := CASE WHEN TG_OP = 'DELETE'
    THEN COALESCE(OLD.value, OLD.role_type, '')
    ELSE COALESCE(NEW.value, NEW.role_type, '')
  END;

  INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles',
    CASE TG_OP
      WHEN 'INSERT' THEN 'Rolle lagt til: ' || v_label
      WHEN 'UPDATE' THEN 'Rolle oppdatert: ' || v_label
      WHEN 'DELETE' THEN 'Rolle slettet: ' || v_label
    END);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_person_roles ON person_roles;
CREATE TRIGGER audit_person_roles
  AFTER INSERT OR UPDATE OR DELETE ON person_roles
  FOR EACH ROW EXECUTE FUNCTION _audit_person_roles();


-- ────────────────────────────────────────────────────────────
-- person_work_experience
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_person_work_experience()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text; v_label text;
BEGIN
  v_op    := lower(TG_OP);
  v_pid   := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;
  v_label := CASE WHEN TG_OP = 'DELETE'
    THEN COALESCE(OLD.employer, OLD.title, '')
    ELSE COALESCE(NEW.employer, NEW.title, '')
  END;

  INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  VALUES (v_pid, _audit_changed_by(), v_op, 'person_work_experience',
    CASE TG_OP
      WHEN 'INSERT' THEN 'Arbeidserfaring lagt til: ' || v_label
      WHEN 'UPDATE' THEN 'Arbeidserfaring oppdatert: ' || v_label
      WHEN 'DELETE' THEN 'Arbeidserfaring slettet: ' || v_label
    END);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_person_work_experience ON person_work_experience;
CREATE TRIGGER audit_person_work_experience
  AFTER INSERT OR UPDATE OR DELETE ON person_work_experience
  FOR EACH ROW EXECUTE FUNCTION _audit_person_work_experience();


-- ────────────────────────────────────────────────────────────
-- person_sources
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_person_sources()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text; v_label text;
BEGIN
  v_op    := lower(TG_OP);
  v_pid   := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;
  v_label := CASE WHEN TG_OP = 'DELETE'
    THEN COALESCE(OLD.archive, OLD.title, '')
    ELSE COALESCE(NEW.archive, NEW.title, '')
  END;

  INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  VALUES (v_pid, _audit_changed_by(), v_op, 'person_sources',
    CASE TG_OP
      WHEN 'INSERT' THEN 'Kilde lagt til: ' || v_label
      WHEN 'UPDATE' THEN 'Kilde oppdatert: ' || v_label
      WHEN 'DELETE' THEN 'Kilde slettet: ' || v_label
    END);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_person_sources ON person_sources;
CREATE TRIGGER audit_person_sources
  AFTER INSERT OR UPDATE OR DELETE ON person_sources
  FOR EACH ROW EXECUTE FUNCTION _audit_person_sources();


-- ────────────────────────────────────────────────────────────
-- address_periods (kun entity_type = 'person')
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_address_periods()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid text; v_op text; v_etype text;
BEGIN
  v_etype := CASE WHEN TG_OP = 'DELETE' THEN OLD.entity_type ELSE NEW.entity_type END;

  -- Bare logg person-adresser
  IF v_etype <> 'person' THEN RETURN NULL; END IF;

  v_op  := lower(TG_OP);
  v_pid := CASE WHEN TG_OP = 'DELETE' THEN OLD.entity_id ELSE NEW.entity_id END;

  INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  VALUES (v_pid, _audit_changed_by(), v_op, 'address_periods',
    CASE TG_OP
      WHEN 'INSERT' THEN 'Adresse lagt til'
      WHEN 'UPDATE' THEN 'Adresse oppdatert'
      WHEN 'DELETE' THEN 'Adresse slettet'
    END);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_address_periods ON address_periods;
CREATE TRIGGER audit_address_periods
  AFTER INSERT OR UPDATE OR DELETE ON address_periods
  FOR EACH ROW EXECUTE FUNCTION _audit_address_periods();
