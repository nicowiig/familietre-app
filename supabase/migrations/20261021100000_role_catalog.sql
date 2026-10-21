-- ============================================================
-- Rollekatalog — standardiserte yrker, embeter, titler og grader
--
-- Prinsipp (samme som for steder, jf. REQ-PLC06):
--   * person_roles.value          = kanonisk, moderne form (vises i UI)
--   * person_roles.original_value = slik kilden skrev det (bevares)
--   * person_roles.role_id        → role_catalog (felles identitet,
--                                   forklaring, hierarki)
--   * title_glossary              = kjente historiske skrivemåter
--                                   → role_catalog (brukes ved import)
--
-- Additivt: eksisterende kolonner og spørringer virker som før.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.role_catalog (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               text NOT NULL UNIQUE,            -- kanonisk form, moderne bokmål
  category           text NOT NULL CHECK (category IN
                       ('occupation','position','title','military_rank','education','other')),
  social_group       text,                             -- stand/sosialt lag, fritekst inntil inndelingen er avklart
  parent_id          integer REFERENCES public.role_catalog(id),  -- bredere rolle: Sogneprest → Prest
  gender_variant_of  integer REFERENCES public.role_catalog(id),  -- Grevinne → Greve
  rank_order         integer,                          -- rekkefølge i adels-/militærhierarki
  description        text,                             -- hva rollen faktisk innebar
  period             text,                             -- når tittelen var i bruk, fritekst
  context            text,                             -- f.eks. «Danmark-Norge», «Det tysk-romerske rike»
  wikidata_id        text,
  is_ai_generated    boolean NOT NULL DEFAULT true,
  is_approved        boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.role_catalog IS
  'Kanoniske roller. person_roles.role_id peker hit. Én rad per rolle uavhengig av historisk skrivemåte.';
COMMENT ON COLUMN public.role_catalog.parent_id IS 'Bredere rolle, f.eks. Sogneprest → Prest, Generalmajor → General.';
COMMENT ON COLUMN public.role_catalog.gender_variant_of IS 'Hunkjønnsform peker på hankjønnsform: Grevinne → Greve.';

CREATE INDEX IF NOT EXISTS idx_role_catalog_parent   ON public.role_catalog(parent_id);
CREATE INDEX IF NOT EXISTS idx_role_catalog_category ON public.role_catalog(category);

DROP TRIGGER IF EXISTS role_catalog_updated_at ON public.role_catalog;
CREATE TRIGGER role_catalog_updated_at BEFORE UPDATE ON public.role_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.role_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rc_select" ON public.role_catalog;
CREATE POLICY "rc_select" ON public.role_catalog FOR SELECT USING (is_approved_user());
DROP POLICY IF EXISTS "rc_admin_write" ON public.role_catalog;
CREATE POLICY "rc_admin_write" ON public.role_catalog FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- person_roles: kobling + bevaring av kildens skrivemåte
ALTER TABLE public.person_roles ADD COLUMN IF NOT EXISTS role_id integer REFERENCES public.role_catalog(id);
ALTER TABLE public.person_roles ADD COLUMN IF NOT EXISTS original_value text;
COMMENT ON COLUMN public.person_roles.original_value IS
  'Rollen slik kilden skrev den (f.eks. «Høiesteretsadvokat»). value er den standardiserte formen.';
CREATE INDEX IF NOT EXISTS idx_person_roles_role_id ON public.person_roles(role_id);

-- Hvordan rollen/tittelen ble oppnådd. NULL = ukjent.
-- Utledes fra profilen (fars/ektemanns titler, «-inde»/«-kone»-former), kan overstyres manuelt.
ALTER TABLE public.person_roles ADD COLUMN IF NOT EXISTS acquired_by text;
ALTER TABLE public.person_roles DROP CONSTRAINT IF EXISTS person_roles_acquired_by_check;
ALTER TABLE public.person_roles ADD CONSTRAINT person_roles_acquired_by_check
  CHECK (acquired_by IS NULL OR acquired_by IN ('fødsel','ekteskap','utnevnelse','erverv'));
COMMENT ON COLUMN public.person_roles.acquired_by IS
  'fødsel | ekteskap | utnevnelse | erverv. Skiller f.eks. født komtesse fra inngiftet grevinne.';

-- title_glossary: historiske skrivemåter → kanonisk rolle
ALTER TABLE public.title_glossary ADD COLUMN IF NOT EXISTS role_id integer REFERENCES public.role_catalog(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_title_glossary_original ON public.title_glossary (lower(original));
CREATE INDEX IF NOT EXISTS idx_title_glossary_role_id ON public.title_glossary(role_id);

-- Endringslogg for person_roles.
-- Samme note-format som før («Rolle lagt til/oppdatert/slettet: X»), men
-- nå også med gammel/ny verdi per felt, slik at historiske skrivemåter
-- ikke går tapt ved fremtidig opprydding. Tomme oppdateringer logges ikke.
CREATE OR REPLACE FUNCTION public._audit_person_roles()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_pid text; v_op text; v_note text; v_logged boolean := false;
BEGIN
  v_op  := lower(TG_OP);
  v_pid := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, new_value, note)
    VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles', 'value', NEW.value,
            'Rolle lagt til: ' || COALESCE(NEW.value, NEW.role_type, ''));
  ELSIF TG_OP = 'UPDATE' THEN
    v_note := 'Rolle oppdatert: ' || COALESCE(NEW.value, NEW.role_type, '');
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
      VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles', 'value', OLD.value, NEW.value, v_note);
      v_logged := true;
    END IF;
    IF OLD.role_type IS DISTINCT FROM NEW.role_type THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
      VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles', 'role_type', OLD.role_type, NEW.role_type, v_note);
      v_logged := true;
    END IF;
    IF OLD.original_value IS DISTINCT FROM NEW.original_value THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
      VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles', 'original_value', OLD.original_value, NEW.original_value, v_note);
      v_logged := true;
    END IF;
    IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
      VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles', 'role_id', OLD.role_id::text, NEW.role_id::text, v_note);
      v_logged := true;
    END IF;
    IF NOT v_logged AND OLD IS DISTINCT FROM NEW THEN
      INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
      VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles', v_note);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, note)
    VALUES (v_pid, _audit_changed_by(), v_op, 'person_roles', 'value', OLD.value,
            'Rolle slettet: ' || COALESCE(OLD.value, OLD.role_type, ''));
  END IF;
  RETURN NULL;
END;
$fn$;
