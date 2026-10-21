# Rollekatalog

Standardiserte yrker, embeter, titler og militære grader for familietreet.

| Fil | Innhold |
|---|---|
| `catalog.py` | Alle kanoniske roller med kategori, stand, hierarki, periode og forklaring |
| `mapping.py` | Hvilken verdi i `person_roles.value` som blir til hvilken rolle (inkl. splitting av sammensatte verdier) |
| `restores.py` | Skrivemåter og roller som gikk tapt ved forrige opprydding, hentet fra endringsloggen |
| `role_catalog.csv` / `role_mapping.csv` | Generert, lesbar oversikt for gjennomgang |
| `load_1_catalog.sql` / `load_2_link.sql` | Generert SQL – kjørt mot prod 2026-10-21 |

Prinsipp: `value` = standardisert form (det som vises og sammenlignes), `original_value` = slik kilden skrev det,
`role_id` → `role_catalog`. Forklaringene er AI-generert og står som `is_approved = false` til de er kvalitetssikret.

Endre katalogen: rediger `.py`-filene, kjør `python3 build.py`, og kjør SQL-filene på nytt (begge er idempotente
for katalogen; koblingen rører bare rader som mangler `role_id`).
