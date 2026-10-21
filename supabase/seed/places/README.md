# Stedsvask

1. `places_raw.json` / `addresses.json`: uttrekk fra databasen (stedsstrenger med antall, adresseregisteret).
2. `normalize.py`: regler (landnavn, norske fylker, utenlandske regioner, historiske bynavn, støy).
3. `run.py`: kjører reglene, utleder land/fylke fra andre forekomster av samme sted.
4. `build.py`: kobler nøkler mot adresseregisteret, finner duplikater -> `plan.json`.
5. `emit_sql.py`: skriver `../fixes/2026-10-21_6_steder.sql`.
6. `gjennomgang_steder.csv`: strenger som ikke kunne kobles automatisk (fase 3).

`place_raw` endres aldri. Nye importer kan slå opp i `place_aliases` (skrivemåte -> sted).
