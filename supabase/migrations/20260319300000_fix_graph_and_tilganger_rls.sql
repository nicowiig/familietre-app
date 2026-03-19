-- ============================================================
-- Fix: Sørg for at family graph og tilganger SELECT virker
--
-- Problem 1: families, family_children, persons, person_names
--   kan mangle SELECT-policy for innloggede brukere etter at
--   "Innloggede brukere kan lese" ble slettet i performance-fix.
--   Løsning: Legg til eksplisitt SELECT for authenticated.
--
-- Problem 2: tilganger_select-policy bruker rekursiv subquery
--   som kan gi uforutsigbar oppførsel.
--   Løsning: Erstatt med en SECURITY DEFINER-funksjon.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- DEL 1: Graph-tabeller — sørg for at alle har SELECT-policy
-- ════════════════════════════════════════════════════════════

-- families
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON families;
DROP POLICY IF EXISTS "families_approved_select"   ON families;
CREATE POLICY "families_approved_select" ON families
    FOR SELECT USING ((select auth.role()) = 'authenticated');

-- family_children
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON family_children;
DROP POLICY IF EXISTS "family_children_approved_select" ON family_children;
CREATE POLICY "family_children_approved_select" ON family_children
    FOR SELECT USING ((select auth.role()) = 'authenticated');

-- persons
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON persons;
DROP POLICY IF EXISTS "persons_approved_select"    ON persons;
CREATE POLICY "persons_approved_select" ON persons
    FOR SELECT USING ((select auth.role()) = 'authenticated');

-- person_names
DROP POLICY IF EXISTS "Innloggede brukere kan lese" ON person_names;
DROP POLICY IF EXISTS "person_names_approved_select" ON person_names;
CREATE POLICY "person_names_approved_select" ON person_names
    FOR SELECT USING ((select auth.role()) = 'authenticated');


-- ════════════════════════════════════════════════════════════
-- DEL 2: familietre_tilganger — ikke-rekursiv SELECT-policy
-- ════════════════════════════════════════════════════════════

-- Hjelpefunksjon som sjekker admin-status uten å trigge RLS
CREATE OR REPLACE FUNCTION is_admin_user(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM familietre_tilganger WHERE user_id = uid LIMIT 1),
        false
    );
$$;

-- Erstatt rekursiv policy med en som bruker SECURITY DEFINER-funksjon
DROP POLICY IF EXISTS "tilganger_select"            ON familietre_tilganger;
DROP POLICY IF EXISTS "admin_read_all_tilganger"    ON familietre_tilganger;
DROP POLICY IF EXISTS "tilganger_own_select"        ON familietre_tilganger;
DROP POLICY IF EXISTS "tilganger_admin_select_all"  ON familietre_tilganger;

-- Alle innloggede ser sin egen rad
CREATE POLICY "tilganger_own_select" ON familietre_tilganger
    FOR SELECT USING (user_id = (select auth.uid()));

-- Admin ser alle rader (via SECURITY DEFINER-funksjon — ingen rekursjon)
CREATE POLICY "tilganger_admin_select_all" ON familietre_tilganger
    FOR SELECT USING (is_admin_user((select auth.uid())));
