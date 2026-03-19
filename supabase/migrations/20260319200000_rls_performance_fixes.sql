-- ============================================================
-- RLS Performance Fixes — mars 2026
--
-- Løser to kategorier advarsler fra Supabase Performance Advisor:
--
-- 1. auth_rls_initplan: auth.role() / auth.uid() evalueres per rad.
--    Fix: wrap i (select auth.role()) / (select auth.uid()).
--
-- 2. multiple_permissive_policies: tabeller har to overlappende
--    SELECT-policies. Årsak: gamle "Innloggede brukere kan lese"-
--    policies ble ikke slettet da _approved_select ble lagt til.
--    Fix: slett de gamle duplikatene.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- DEL 1: Slett duplikate policies (multiple_permissive_policies)
-- ════════════════════════════════════════════════════════════

-- Hovedtabeller: slett de gamle "Innloggede brukere kan lese"-
-- policies. De er allerede dekket av xxx_approved_select.
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON persons;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_names;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_facts;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_addresses;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_biography;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_roles;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_photos;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_sources;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON families;
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON family_children;

-- person_photos: slett eldre INSERT- og SELECT-duplikater
DROP POLICY IF EXISTS "approved users can insert photos"     ON person_photos;
DROP POLICY IF EXISTS "authenticated users can select photos" ON person_photos;

-- familietre_tilganger: slett eldre norske policies som er
-- erstattet av de nye tilganger_*-policiene
DROP POLICY IF EXISTS "Bruker ser egen rad"             ON familietre_tilganger;
DROP POLICY IF EXISTS "Bruker kan opprette forespørsel" ON familietre_tilganger;

-- familietre_tilganger UPDATE: slett den usikre versjonen,
-- behold tilganger_admin_update_safe
DROP POLICY IF EXISTS "tilganger_admin_update" ON familietre_tilganger;


-- ════════════════════════════════════════════════════════════
-- DEL 2: Fix auth_rls_initplan — (select auth.xxx())
--
-- For tabeller der "Innloggede brukere kan lese" ble slettet
-- i Del 1 trenger vi ingen rewrite der (policy er borte).
-- Gjenstående tabeller som fortsatt har auth.role()/ auth.uid():
-- ════════════════════════════════════════════════════════════

-- ─── family_branches ─────────────────────────────────────────
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON family_branches;
CREATE POLICY "Innloggede brukere kan lese" ON family_branches
    FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ─── family_branch_sources ───────────────────────────────────
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON family_branch_sources;
CREATE POLICY "Innloggede brukere kan lese" ON family_branch_sources
    FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ─── branch_user_relations ───────────────────────────────────
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON branch_user_relations;
CREATE POLICY "Innloggede brukere kan lese" ON branch_user_relations
    FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ─── duplicate_ignores ───────────────────────────────────────
DROP POLICY IF EXISTS "Innloggede kan slette egne ignorerte par" ON duplicate_ignores;
CREATE POLICY "Innloggede kan slette egne ignorerte par"
    ON duplicate_ignores FOR DELETE TO authenticated
    USING (ignored_by = (select auth.uid()) OR ignored_by IS NULL);

-- ─── familietre_tilganger ────────────────────────────────────
-- Slår sammen tilganger_own_select + tilganger_admin_select_all til én policy.
-- Vanlig bruker ser kun sin egen rad; admin ser alle.
DROP POLICY IF EXISTS "tilganger_own_select"       ON familietre_tilganger;
DROP POLICY IF EXISTS "tilganger_admin_select_all" ON familietre_tilganger;
DROP POLICY IF EXISTS "tilganger_insert_own"       ON familietre_tilganger;

CREATE POLICY "tilganger_select" ON familietre_tilganger
    FOR SELECT USING (
        user_id = (select auth.uid())
        OR (
            SELECT is_admin FROM familietre_tilganger
            WHERE user_id = (select auth.uid())
            LIMIT 1
        ) = true
    );
CREATE POLICY "tilganger_insert_own" ON familietre_tilganger
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- ─── person_work_experience ──────────────────────────────────
DROP POLICY IF EXISTS "we_select" ON person_work_experience;
DROP POLICY IF EXISTS "we_insert" ON person_work_experience;
DROP POLICY IF EXISTS "we_update" ON person_work_experience;
DROP POLICY IF EXISTS "we_delete" ON person_work_experience;

CREATE POLICY "we_select" ON person_work_experience
    FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "we_insert" ON person_work_experience
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "we_update" ON person_work_experience
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "we_delete" ON person_work_experience
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── person_education ────────────────────────────────────────
DROP POLICY IF EXISTS "edu_select" ON person_education;
DROP POLICY IF EXISTS "edu_insert" ON person_education;
DROP POLICY IF EXISTS "edu_update" ON person_education;
DROP POLICY IF EXISTS "edu_delete" ON person_education;

CREATE POLICY "edu_select" ON person_education
    FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "edu_insert" ON person_education
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "edu_update" ON person_education
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "edu_delete" ON person_education
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── person_quotes ───────────────────────────────────────────
DROP POLICY IF EXISTS "quotes_select" ON person_quotes;
DROP POLICY IF EXISTS "quotes_insert" ON person_quotes;
DROP POLICY IF EXISTS "quotes_update" ON person_quotes;
DROP POLICY IF EXISTS "quotes_delete" ON person_quotes;

CREATE POLICY "quotes_select" ON person_quotes
    FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "quotes_insert" ON person_quotes
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "quotes_update" ON person_quotes
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "quotes_delete" ON person_quotes
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── person_religion ─────────────────────────────────────────
DROP POLICY IF EXISTS "rel_select" ON person_religion;
DROP POLICY IF EXISTS "rel_insert" ON person_religion;
DROP POLICY IF EXISTS "rel_update" ON person_religion;
DROP POLICY IF EXISTS "rel_delete" ON person_religion;

CREATE POLICY "rel_select" ON person_religion
    FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "rel_insert" ON person_religion
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "rel_update" ON person_religion
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "rel_delete" ON person_religion
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── person_languages ────────────────────────────────────────
DROP POLICY IF EXISTS "lang_select" ON person_languages;
DROP POLICY IF EXISTS "lang_insert" ON person_languages;
DROP POLICY IF EXISTS "lang_update" ON person_languages;
DROP POLICY IF EXISTS "lang_delete" ON person_languages;

CREATE POLICY "lang_select" ON person_languages
    FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "lang_insert" ON person_languages
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "lang_update" ON person_languages
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "lang_delete" ON person_languages
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── title_glossary ──────────────────────────────────────────
-- tg_select bruker USING (true) — ingen auth-kall, trenger ikke fix
DROP POLICY IF EXISTS "tg_insert" ON title_glossary;
DROP POLICY IF EXISTS "tg_update" ON title_glossary;
DROP POLICY IF EXISTS "tg_delete" ON title_glossary;

CREATE POLICY "tg_insert" ON title_glossary
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "tg_update" ON title_glossary
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "tg_delete" ON title_glossary
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── place_aliases ───────────────────────────────────────────
-- pa_select bruker USING (true) — ingen auth-kall, trenger ikke fix
DROP POLICY IF EXISTS "pa_insert" ON place_aliases;
DROP POLICY IF EXISTS "pa_update" ON place_aliases;
DROP POLICY IF EXISTS "pa_delete" ON place_aliases;

CREATE POLICY "pa_insert" ON place_aliases
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "pa_update" ON place_aliases
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "pa_delete" ON place_aliases
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── family_branch_persons ───────────────────────────────────
DROP POLICY IF EXISTS "fbp_select" ON family_branch_persons;
DROP POLICY IF EXISTS "fbp_insert" ON family_branch_persons;
DROP POLICY IF EXISTS "fbp_update" ON family_branch_persons;
DROP POLICY IF EXISTS "fbp_delete" ON family_branch_persons;

CREATE POLICY "fbp_select" ON family_branch_persons
    FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "fbp_insert" ON family_branch_persons
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "fbp_update" ON family_branch_persons
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "fbp_delete" ON family_branch_persons
    FOR DELETE USING ((select auth.role()) = 'service_role');

-- ─── person_media ────────────────────────────────────────────
DROP POLICY IF EXISTS "person_media_select" ON person_media;
DROP POLICY IF EXISTS "person_media_insert" ON person_media;
DROP POLICY IF EXISTS "person_media_update" ON person_media;
DROP POLICY IF EXISTS "person_media_delete" ON person_media;

CREATE POLICY "person_media_select" ON person_media
    FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "person_media_insert" ON person_media
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "person_media_update" ON person_media
    FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "person_media_delete" ON person_media
    FOR DELETE USING ((select auth.role()) = 'service_role');


-- ════════════════════════════════════════════════════════════
-- DEL 3: Indekser på fremmednøkler (unindexed_foreign_keys)
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_branch_user_relations_connecting_person_id ON branch_user_relations (connecting_person_id);
CREATE INDEX IF NOT EXISTS idx_branch_user_relations_user_person_id       ON branch_user_relations (user_person_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_ignores_ignored_by               ON duplicate_ignores (ignored_by);
CREATE INDEX IF NOT EXISTS idx_familietre_tilganger_person_id              ON familietre_tilganger (person_id);
CREATE INDEX IF NOT EXISTS idx_person_addresses_person_id                  ON person_addresses (person_id);
CREATE INDEX IF NOT EXISTS idx_person_biography_person_id                  ON person_biography (person_id);
CREATE INDEX IF NOT EXISTS idx_person_languages_person_id                  ON person_languages (person_id);
CREATE INDEX IF NOT EXISTS idx_person_media_source_id                      ON person_media (source_id);
CREATE INDEX IF NOT EXISTS idx_person_quotes_person_id                     ON person_quotes (person_id);
CREATE INDEX IF NOT EXISTS idx_person_religion_person_id                   ON person_religion (person_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_person_id                      ON person_roles (person_id);
CREATE INDEX IF NOT EXISTS idx_person_sources_person_id                    ON person_sources (person_id);
CREATE INDEX IF NOT EXISTS idx_person_work_experience_address_id           ON person_work_experience (address_id);
CREATE INDEX IF NOT EXISTS idx_person_work_experience_address_period_id    ON person_work_experience (address_period_id);
CREATE INDEX IF NOT EXISTS idx_place_article_sources_article_id            ON place_article_sources (article_id);
