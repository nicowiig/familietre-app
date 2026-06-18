-- Legg til is_confirmed for adresseperioder
-- Markerer om dato-verdiene er bekreftet av bruker eller antatt/beregnet

ALTER TABLE address_periods ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT FALSE;

-- Sett confirmed=true for Nicolays egne adresser (han har bekreftet dem)
UPDATE address_periods SET is_confirmed = true WHERE entity_id = 'I500001' AND entity_type = 'person';

-- RLS: tillat innloggede brukere å oppdatere (dato + is_confirmed)
CREATE POLICY "address_periods_update_authenticated"
    ON address_periods FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
