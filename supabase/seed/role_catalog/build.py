# -*- coding: utf-8 -*-
"""
Validerer rollekatalogen og genererer:
  * role_catalog.csv  – lesbar oversikt for gjennomgang
  * role_mapping.csv  – hvilke verdier som blir til hvilken rolle
  * load.sql          – én transaksjon som laster katalogen og kobler person_roles

Kjør:  python3 supabase/seed/role_catalog/build.py
"""
import csv, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from catalog import CATALOG, GROUPS          # noqa: E402
from mapping import MAPPING                  # noqa: E402
from restores import RESTORES                # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CATEGORIES = {"occupation", "position", "title", "military_rank", "education", "other"}
ACQ = {None, "fødsel", "ekteskap", "utnevnelse", "erverv"}

LANG = {
    "da": ["Amtmand", "Rådmand", "Byfoged", "Stiftsbefalingsmand", "Provstinde", "Præstekone",
           "Generalinde", "Hertugesse", "Erkehertugesse", "Elskerinde", "Skoemager", "Tjenestepige",
           "Fruerpige", "Sagfører", "Bogholder", "Commerceråd", "Farver", "Lennsmannshustru",
           "Dansk-norsk stiftamtmand", "Extratollbetient", "Kapelmester", "Hotelvertinne",
           "Mynsterskriver", "Rådstuskriver", "Støberimester", "Feltserer", "Forpagter paa Svanholmsminde",
           "Høiesteretsadvokat", "Overretssakfører", "Violonist", "Prostfrue", "Prestefrue"],
    "de": ["Kronprinz", "Kurprinzessin", "Freiin", "Amtshauptmann", "Reichs-Oberfeldhauptmann",
           "Markgraf av Brandenburg", "Timmerman"],
    "en": ["Lieutenant", "Shop Assistant", "Marine Surveyor", "Business Farm, Kjøpmann London"],
    "sv": ["Skattefränstorplsehemmansåbo", "Captajn, kapten"],
    "la": ["Pastor Luterano", "Negotiant", "Guvernor"],
}
LANG_OF = {v: k for k, vs in LANG.items() for v in vs}


def q(s):
    """SQL-literal med dollar-quoting (tåler apostrofer og «»)."""
    if s is None:
        return "NULL"
    tag = "$q$"
    assert tag not in str(s)
    return f"{tag}{s}{tag}"


def validate():
    names = [c[0] for c in CATALOG]
    errs = []
    dup = {n for n in names if names.count(n) > 1}
    if dup:
        errs.append(f"Duplikate navn: {dup}")
    nameset = set(names)
    for name, cat, grp, parent, gvar, rank, period, ctx, desc in CATALOG:
        if cat not in CATEGORIES:
            errs.append(f"{name}: ukjent kategori {cat}")
        if grp is not None and grp not in GROUPS:
            errs.append(f"{name}: ukjent gruppe {grp}")
        for ref in (parent, gvar):
            if ref and ref not in nameset:
                errs.append(f"{name}: peker på ukjent rolle {ref}")
        if not desc:
            errs.append(f"{name}: mangler forklaring")
    for raw, spec in MAPPING.items():
        if spec is None:
            continue
        for item in spec:
            canon, extra = (item, {}) if isinstance(item, str) else item
            if canon not in nameset:
                errs.append(f"Mapping «{raw}» → ukjent rolle «{canon}»")
            if extra.get("acquired_by") not in ACQ:
                errs.append(f"Mapping «{raw}»: ugyldig acquired_by")
    for pid, canon, hist, action, extra in RESTORES:
        if canon not in nameset:
            errs.append(f"Restore {pid}: ukjent rolle {canon}")
        if action not in ("original", "insert"):
            errs.append(f"Restore {pid}: ukjent handling {action}")
    used = set()
    for spec in MAPPING.values():
        for item in (spec or []):
            used.add(item if isinstance(item, str) else item[0])
    used |= {r[1] for r in RESTORES}
    parents = {c[3] for c in CATALOG} | {c[4] for c in CATALOG}
    unused = sorted(nameset - used - parents)
    return errs, unused


def write_csvs():
    with open(os.path.join(HERE, "role_catalog.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["name", "category", "social_group", "parent", "gender_variant_of",
                    "rank_order", "period", "context", "description"])
        for row in sorted(CATALOG, key=lambda c: (GROUPS.index(c[2]) if c[2] in GROUPS else 99, c[0])):
            w.writerow(row)
    with open(os.path.join(HERE, "role_mapping.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["value_today", "becomes", "place_if_empty", "acquired_by"])
        for raw, spec in sorted(MAPPING.items(), key=lambda kv: kv[0].lower()):
            if spec is None:
                w.writerow([raw, "(ikke en rolle – røres ikke)", "", ""])
                continue
            for item in spec:
                canon, extra = (item, {}) if isinstance(item, str) else item
                w.writerow([raw, canon, extra.get("place", ""), extra.get("acquired_by", "")])


def build_sql():
    out = []
    a = out.append
    a("-- Generert av scripts/role_catalog/build.py – ikke rediger for hånd.")
    a("BEGIN;")
    a("")
    a("-- 1. Katalog")
    a("INSERT INTO role_catalog (name, category, social_group, rank_order, period, context, description, is_ai_generated, is_approved) VALUES")
    rows = []
    for name, cat, grp, parent, gvar, rank, period, ctx, desc in CATALOG:
        rows.append(f"  ({q(name)}, {q(cat)}, {q(grp)}, {rank if rank is not None else 'NULL'}, "
                    f"{q(period)}, {q(ctx)}, {q(desc)}, true, false)")
    a(",\n".join(rows))
    a("ON CONFLICT (name) DO UPDATE SET category=EXCLUDED.category, social_group=EXCLUDED.social_group,")
    a("  rank_order=EXCLUDED.rank_order, period=EXCLUDED.period, context=EXCLUDED.context,")
    a("  description=EXCLUDED.description;")
    a("")
    rel = [(n, p, g) for n, _, _, p, g, *_ in CATALOG if p or g]
    a("UPDATE role_catalog rc SET parent_id = p.id FROM (VALUES")
    a(",\n".join(f"  ({q(n)}, {q(p)})" for n, p, g in rel if p))
    a(") AS v(name, parent) JOIN role_catalog p ON p.name = v.parent WHERE rc.name = v.name;")
    a("UPDATE role_catalog rc SET gender_variant_of = g.id FROM (VALUES")
    a(",\n".join(f"  ({q(n)}, {q(g)})" for n, p, g in rel if g))
    a(") AS v(name, gv) JOIN role_catalog g ON g.name = v.gv WHERE rc.name = v.name;")
    a("")

    a("COMMIT;")
    a("-- @@SPLIT@@")
    a("BEGIN;")
    a("-- 2. Mappingtabell (verdi i dag → kanonisk rolle, rekkefølge for sammensatte verdier)")
    a("CREATE TEMP TABLE _rmap (raw text, idx int, canon text, place text, acquired_by text) ON COMMIT DROP;")
    mrows = []
    for raw, spec in MAPPING.items():
        if spec is None:
            continue
        for i, item in enumerate(spec, start=1):
            canon, extra = (item, {}) if isinstance(item, str) else item
            mrows.append(f"  ({q(raw)}, {i}, {q(canon)}, {q(extra.get('place'))}, {q(extra.get('acquired_by'))})")
    a("INSERT INTO _rmap VALUES\n" + ",\n".join(mrows) + ";")
    a("")
    a("-- role_type følger katalogens kategori; politiske/offentlige verv og eksamen beholder sin undertype")
    a("""CREATE OR REPLACE FUNCTION pg_temp._rtype(cat text, old text) RETURNS text LANGUAGE sql AS $f$
  SELECT CASE
    WHEN cat = 'position'  AND old IN ('political','public_office') THEN old
    WHEN cat = 'education' AND old IN ('education','exam') THEN old
    WHEN cat = 'other'     THEN 'other'
    ELSE cat END
$f$;""")
    a("")
    a("-- 3. Ekstra rader for sammensatte verdier (idx > 1), kopiert fra originalraden")
    a("""INSERT INTO person_roles (person_id, role_type, value, place, date_from, date_to, reason, source,
                          role_id, original_value, acquired_by)
SELECT r.person_id, pg_temp._rtype(rc.category, r.role_type), rc.name, COALESCE(r.place, m.place),
       r.date_from, r.date_to, r.reason, r.source, rc.id, r.value, m.acquired_by
FROM person_roles r
JOIN _rmap m ON m.raw = r.value AND m.idx > 1
JOIN role_catalog rc ON rc.name = m.canon
WHERE r.role_id IS NULL;""")
    a("")
    a("-- 4. Originalraden får første rolle; avvikende tekst bevares i original_value")
    a("""UPDATE person_roles r SET
  role_id        = rc.id,
  original_value = COALESCE(r.original_value, CASE WHEN r.value <> rc.name THEN r.value END),
  value          = rc.name,
  place          = COALESCE(r.place, m.place),
  acquired_by    = COALESCE(r.acquired_by, m.acquired_by),
  role_type      = pg_temp._rtype(rc.category, r.role_type)
FROM _rmap m JOIN role_catalog rc ON rc.name = m.canon
WHERE m.raw = r.value AND m.idx = 1 AND r.role_id IS NULL;""")
    a("")
    a("-- 5. Gjenoppretting fra endringsloggen")
    orig = [r for r in RESTORES if r[3] == "original"]
    ins = [r for r in RESTORES if r[3] == "insert"]
    a("UPDATE person_roles p SET original_value = x.hist FROM (")
    a("  SELECT DISTINCT ON (v.pid, v.canon) r.id, v.hist FROM (VALUES")
    a(",\n".join(f"    ({q(pid)}, {q(c)}, {q(h)})" for pid, c, h, _, _ in orig))
    a("  ) AS v(pid, canon, hist)")
    a("  JOIN role_catalog rc ON rc.name = v.canon")
    a("  JOIN person_roles r ON r.person_id = v.pid AND r.role_id = rc.id")
    a("  ORDER BY v.pid, v.canon, (r.original_value IS NULL) DESC, r.id")
    a(") x WHERE p.id = x.id;")
    a("INSERT INTO person_roles (person_id, role_type, value, place, date_from, role_id, original_value, source)")
    a("SELECT v.pid, pg_temp._rtype(rc.category, 'occupation'), rc.name, v.place, v.dfrom, rc.id, v.hist,")
    a("       'Gjenopprettet fra endringsloggen 2026-10-21'")
    a("FROM (VALUES")
    a(",\n".join(f"  ({q(pid)}, {q(c)}, {q(h)}, {q(e.get('place'))}, {q(e.get('date_from'))})" for pid, c, h, _, e in ins))
    a(") AS v(pid, canon, hist, place, dfrom)")
    a("JOIN role_catalog rc ON rc.name = v.canon")
    a("WHERE NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = v.pid AND x.role_id = rc.id);")
    a("")
    a("-- 6. Ordliste: historiske skrivemåter → kanonisk rolle (brukes ved fremtidig import)")
    langs = sorted(LANG_OF.items())
    from collections import Counter
    hc = Counter(h for _, _, h, act, _ in RESTORES if act == "original")
    short_hist = [(h, c) for _, c, h, act, _ in RESTORES
                  if act == "original" and hc[h] == 1 and len(h) <= 40 and h != c]
    a("INSERT INTO title_glossary (original, modern_norwegian, language, role_id, explanation_no)")
    a("SELECT DISTINCT ON (lower(s.raw)) s.raw, s.canon, l.lang, rc.id, rc.description FROM (")
    a("  SELECT m.raw, m.canon FROM _rmap m")
    a("  WHERE m.raw <> m.canon AND NOT EXISTS (SELECT 1 FROM _rmap m2 WHERE m2.raw = m.raw AND m2.idx > 1)")
    a("  UNION ALL SELECT * FROM (VALUES")
    a(",\n".join(f"    ({q(h)}, {q(c)})" for h, c in short_hist))
    a("  ) AS h(raw, canon)")
    a(") s")
    a("JOIN role_catalog rc ON rc.name = s.canon")
    a("LEFT JOIN (VALUES")
    a(",\n".join(f"  ({q(r)}, {q(l)})" for r, l in langs))
    a(") AS l(raw, lang) ON l.raw = s.raw")
    a("ORDER BY lower(s.raw)")
    a("ON CONFLICT ((lower(original))) DO UPDATE SET modern_norwegian = EXCLUDED.modern_norwegian, role_id = EXCLUDED.role_id;")
    a("")
    a("-- 7. Utled «oppnådd ved» for titler (bare der det ikke allerede er satt)")
    a("""WITH fam AS (
  SELECT fc.child_id AS person_id, f.husband_id AS father_id FROM family_children fc JOIN families f USING (family_id)
), spouse AS (
  SELECT wife_id AS person_id, husband_id AS spouse_id FROM families WHERE wife_id IS NOT NULL AND husband_id IS NOT NULL
), t AS (
  SELECT r.id, r.person_id, rc.id AS role_id, rc.name, rc.gender_variant_of, rc.social_group, p.sex
  FROM person_roles r JOIN role_catalog rc ON rc.id = r.role_id JOIN persons p USING (person_id)
  WHERE rc.category = 'title' AND r.acquired_by IS NULL
), derived AS (
  SELECT t.id,
    CASE
      WHEN t.social_group IN ('Sivile embetsmenn','Hoff','Borgerskap – handel') THEN 'utnevnelse'
      WHEN t.name = 'Kurprinsesse' THEN 'ekteskap'
      -- hustru-titler: ektemannen har hankjønnsformen
      WHEN t.gender_variant_of IS NOT NULL AND t.name <> 'Prinsesse' AND EXISTS (
        SELECT 1 FROM spouse s JOIN person_roles h ON h.person_id = s.spouse_id
        JOIN role_catalog hc ON hc.id = h.role_id
        WHERE s.person_id = t.person_id AND (h.role_id = t.gender_variant_of OR hc.parent_id = t.gender_variant_of))
        THEN 'ekteskap'
      -- født inn i standen: faren har tittel i samme gruppe
      WHEN EXISTS (
        SELECT 1 FROM fam JOIN person_roles fr ON fr.person_id = fam.father_id
        JOIN role_catalog fc ON fc.id = fr.role_id
        WHERE fam.person_id = t.person_id AND fc.category = 'title' AND fc.social_group = t.social_group)
        THEN 'fødsel'
      -- kvinne med tittel der bare ektemannen har tittel i samme gruppe
      WHEN t.sex = 'F' AND EXISTS (
        SELECT 1 FROM spouse s JOIN person_roles h ON h.person_id = s.spouse_id
        JOIN role_catalog hc ON hc.id = h.role_id
        WHERE s.person_id = t.person_id AND hc.category = 'title' AND hc.social_group = t.social_group)
        THEN 'ekteskap'
    END AS acq
  FROM t
)
UPDATE person_roles r SET acquired_by = d.acq FROM derived d WHERE r.id = d.id AND d.acq IS NOT NULL;""")
    a("-- 8. Slå sammen eksakte duplikater (samme person, rolle, sted og datoer); behold alle kildeformer")
    a("""WITH g AS (
  SELECT person_id, role_id, COALESCE(place,'') pl, COALESCE(date_from,'') df, COALESCE(date_to,'') dt,
         min(id) keep_id,
         string_agg(DISTINCT original_value, ' | ') FILTER (WHERE original_value IS NOT NULL) origs,
         (array_agg(reason) FILTER (WHERE reason IS NOT NULL))[1] rsn,
         (array_agg(acquired_by) FILTER (WHERE acquired_by IS NOT NULL))[1] acq
  FROM person_roles WHERE role_id IS NOT NULL
  GROUP BY 1,2,3,4,5 HAVING count(*) > 1
), upd AS (
  UPDATE person_roles r SET original_value = COALESCE(g.origs, r.original_value),
         reason = COALESCE(r.reason, g.rsn), acquired_by = COALESCE(r.acquired_by, g.acq)
  FROM g WHERE r.id = g.keep_id RETURNING r.id
)
DELETE FROM person_roles r USING g
WHERE r.person_id = g.person_id AND r.role_id = g.role_id AND COALESCE(r.place,'') = g.pl
  AND COALESCE(r.date_from,'') = g.df AND COALESCE(r.date_to,'') = g.dt AND r.id <> g.keep_id;""")
    a("")
    a("COMMIT;")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    errs, unused = validate()
    if errs:
        print("FEIL:\n  " + "\n  ".join(errs))
        sys.exit(1)
    write_csvs()
    sql = build_sql()
    part1, part2 = sql.split("-- @@SPLIT@@\n")
    for name, body in (("load_1_catalog.sql", part1), ("load_2_link.sql", part2)):
        with open(os.path.join(HERE, name), "w", encoding="utf-8") as f:
            f.write(body)
    print(f"OK: {len(CATALOG)} roller, {sum(1 for v in MAPPING.values() if v)} verdier mappet, "
          f"{sum(1 for v in MAPPING.values() if v is None)} ikke-roller, {len(RESTORES)} gjenopprettinger.")
    if unused:
        print("Roller i katalogen uten bruk (OK, men sjekk):", ", ".join(unused))
    print(f"load_1_catalog.sql: {len(part1)//1024} KB, load_2_link.sql: {len(part2)//1024} KB")
