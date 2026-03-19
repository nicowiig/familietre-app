-- Sikkerhetsfikser: aktiver RLS på 8 tabeller + fix set_updated_at search_path
-- Rapport fra Supabase Security Advisor, mars 2026

-- ─── 1. Fikse set_updated_at — mutable search_path ───────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ─── 2. person_work_experience ────────────────────────────────
ALTER TABLE person_work_experience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "we_select" ON person_work_experience
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "we_insert" ON person_work_experience
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "we_update" ON person_work_experience
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "we_delete" ON person_work_experience
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── 3. person_education ─────────────────────────────────────
ALTER TABLE person_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edu_select" ON person_education
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "edu_insert" ON person_education
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "edu_update" ON person_education
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "edu_delete" ON person_education
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── 4. person_quotes ────────────────────────────────────────
ALTER TABLE person_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON person_quotes
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "quotes_insert" ON person_quotes
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "quotes_update" ON person_quotes
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "quotes_delete" ON person_quotes
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── 5. person_religion ──────────────────────────────────────
ALTER TABLE person_religion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rel_select" ON person_religion
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rel_insert" ON person_religion
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "rel_update" ON person_religion
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "rel_delete" ON person_religion
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── 6. person_languages ─────────────────────────────────────
ALTER TABLE person_languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lang_select" ON person_languages
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "lang_insert" ON person_languages
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "lang_update" ON person_languages
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "lang_delete" ON person_languages
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── 7. title_glossary ───────────────────────────────────────
-- Oppslagstabell — anon-brukere trenger lese-tilgang for tittel-tooltip
ALTER TABLE title_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tg_select" ON title_glossary
    FOR SELECT USING (true);   -- offentlig lesbar oppslagstabell
CREATE POLICY "tg_insert" ON title_glossary
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "tg_update" ON title_glossary
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "tg_delete" ON title_glossary
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── 8. place_aliases ────────────────────────────────────────
-- Oppslagstabell — anon-brukere trenger lese-tilgang for stedsnavn
ALTER TABLE place_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_select" ON place_aliases
    FOR SELECT USING (true);   -- offentlig lesbar oppslagstabell
CREATE POLICY "pa_insert" ON place_aliases
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "pa_update" ON place_aliases
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "pa_delete" ON place_aliases
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── 9. family_branch_persons ────────────────────────────────
ALTER TABLE family_branch_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fbp_select" ON family_branch_persons
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "fbp_insert" ON family_branch_persons
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "fbp_update" ON family_branch_persons
    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "fbp_delete" ON family_branch_persons
    FOR DELETE USING (auth.role() = 'service_role');

-- ─── Merk: gjenværende advarsler ─────────────────────────────
-- WARN: duplicate_ignores INSERT policy er `WITH CHECK (true)` for authenticated.
--   Dette er BEVISST: alle innloggede brukere skal kunne markere duplikatpar.
--   Ikke en sårbarhet i kontekst av denne appen.
--
-- WARN: auth_leaked_password_protection = disabled.
--   Må aktiveres manuelt i Supabase Dashboard →
--   Authentication → Password Security → Enable Leaked Password Protection.
--   Kan ikke settes via SQL-migrasjon.
