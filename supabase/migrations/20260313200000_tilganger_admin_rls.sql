-- ============================================================
-- MIGRASJON: Admin kan lese alle rader i familietre_tilganger
-- Dato: 2026-03-13
--
-- Problem: RLS tillot kun brukere å lese egen rad (user_id = auth.uid()).
-- Admin-siden kan dermed ikke se andres forespørsler.
--
-- Løsning: Legg til policy som lar admin-brukere lese alle rader.
-- "Admin" defineres som: IS_ADMIN = true i egen rad.
-- ============================================================

CREATE POLICY "admin_read_all_tilganger"
  ON familietre_tilganger
  FOR SELECT
  TO authenticated
  USING (
    (
      SELECT is_admin
      FROM familietre_tilganger
      WHERE user_id = auth.uid()
      LIMIT 1
    ) = true
  );
