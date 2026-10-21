-- ============================================================
-- Steder del 8 (21.10.2026): de manuelle stedene etter gjennomgang + sjekk av fylke/land
-- place_raw endres ikke. Merknader legges i notes på hendelsen.
-- ============================================================
BEGIN;
CREATE TEMP TABLE _m (raw text PRIMARY KEY, target integer, name text, region text, country text, disp text, note text) ON COMMIT DROP;
INSERT INTO _m VALUES
('Alesund,',558,NULL,NULL,NULL,NULL,NULL),
('Solheim,',657,NULL,NULL,NULL,NULL,NULL),
('Fussingø',474,NULL,NULL,NULL,NULL,NULL),
('Broby (L), Friggatofta',939,NULL,NULL,NULL,NULL,NULL),
('Fodslette, Langeland',639,NULL,NULL,NULL,NULL,NULL),
('Ledegård, Nysogn S. Hind H. Ringkøbing A.',213,NULL,NULL,NULL,NULL,NULL),
('Rømskog',561,NULL,NULL,NULL,NULL,NULL),
('Słońsk',821,NULL,NULL,NULL,NULL,NULL),
('Velling',453,NULL,NULL,NULL,NULL,NULL),
('''Straume, Mo sokn, Modalen''',NULL,'Straume, Mo, Modalen','Hordaland','Norge','Straume, Mo, Modalen',NULL),
('Aalborg Budolfi',NULL,'Budolfi kirke, Aalborg','Aalborg','Danmark','Budolfi kirke, Aalborg, Danmark',NULL),
('Altenburg, Sachsen-Altenburg, Thüringen',791,NULL,NULL,NULL,NULL,NULL),
('Amundebyn, Östervallskog',834,NULL,NULL,NULL,NULL,NULL),
('Amundsrød, Østervallskog / Tøcksmark',NULL,'Amundsrød, Östervallskog','Värmland','Sverige','Amundsrød, Östervallskog, Värmland, Sverige',NULL),
('Annaborg, Hillerød, Lynge Frederiksborg',NULL,'Annaborg, Hillerød','Frederiksborg','Danmark','Annaborg, Hillerød, Frederiksborg, Danmark',NULL),
('Arum',463,NULL,NULL,NULL,NULL,NULL),
('Bengalen, Indien',850,NULL,NULL,NULL,NULL,NULL),
('Berg Sogn, Brundlaugnæs',NULL,'Berg, Brunlanes','Vestfold','Norge','Berg, Brunlanes',NULL),
('Berg Sogn, Brunlaugnæs',NULL,'Berg, Brunlanes','Vestfold','Norge','Berg, Brunlanes',NULL),
('Bergum',NULL,'Bergum','Friesland','Nederland','Bergum, Friesland, Nederland',NULL),
('Bjerke Brandbu',NULL,'Bjerke, Brandbu','Oppland','Norge','Bjerke, Brandbu',NULL),
('Bodo Trondhjeim, Noruega',NULL,'Bodø','Nordland','Norge','Bodø',NULL),
('Bolsward',468,NULL,NULL,NULL,NULL,NULL),
('Bordeaux',747,NULL,NULL,NULL,NULL,NULL),
('Brandben',426,NULL,NULL,NULL,NULL,NULL),
('Bratislava, Bratislava, Czechoslovkia',NULL,'Bratislava',NULL,'Slovakia','Bratislava, Slovakia',NULL),
('Bårdsgarden, Innfjorden',NULL,'Bårdsgarden, Innfjorden, Rauma','Møre og Romsdal','Norge','Bårdsgarden, Innfjorden, Rauma',NULL),
('Cementerio de la Capilla de Lade Kirke en Tromheim, Noruega',NULL,'Lade kirkegård, Trondheim','Sør-Trøndelag','Norge','Lade kirkegård, Trondheim',NULL),
('Cementerio de la Capilla de Lade Kirke, en Tromheim, Noruega',NULL,'Lade kirkegård, Trondheim','Sør-Trøndelag','Norge','Lade kirkegård, Trondheim',NULL),
('Den Haag, Südholland, Niederlande',740,NULL,NULL,NULL,NULL,NULL),
('Dikemark jernværk',NULL,'Dikemark jernverk, Asker','Akershus','Norge','Dikemark jernverk, Asker',NULL),
('Dongjum',467,NULL,NULL,NULL,NULL,NULL),
('Ellingsrudhjemmet',NULL,'Ellingsrudhjemmet, Oslo','Akershus','Norge','Ellingsrudhjemmet, Oslo',NULL),
('Elsterwerda',NULL,'Elsterwerda','Brandenburg','Tyskland','Elsterwerda, Brandenburg, Tyskland',NULL),
('Esslingen am Neckar',170,NULL,NULL,NULL,NULL,NULL),
('Farstrup,',452,NULL,NULL,NULL,NULL,NULL),
('Fosse, Meland',NULL,'Fosse, Meland','Hordaland','Norge','Fosse, Meland',NULL),
('Fredriksvern Båtsmannsgården',NULL,'Båtsmannsgården, Stavern','Vestfold','Norge','Båtsmannsgården, Stavern',NULL),
('Frongner',NULL,'Frogner',NULL,'Norge','Frogner',NULL),
('Gausdal',301,NULL,NULL,NULL,NULL,NULL),
('Gerkesklooster',621,NULL,NULL,NULL,NULL,NULL),
('Glatz',NULL,'Kłodzko','Schlesien','Polen','Kłodzko, Schlesien, Polen',NULL),
('Glücksburg',NULL,'Glücksburg','Slesvig-Holsten','Tyskland','Glücksburg, Slesvig-Holsten, Tyskland',NULL),
('Gressvik',296,NULL,NULL,NULL,NULL,NULL),
('Göteborg',479,NULL,NULL,NULL,NULL,NULL),
('Hakadal / Nittedal',NULL,'Hakadal, Nittedal','Akershus','Norge','Hakadal, Nittedal',NULL),
('Hardegarijp',464,NULL,NULL,NULL,NULL,NULL),
('Haugom',525,NULL,NULL,NULL,NULL,NULL),
('Haugum, Overhalla',NULL,'Haugum, Overhalla','Nord-Trøndelag','Norge','Haugum, Overhalla',NULL),
('Hesteflotene',840,NULL,NULL,NULL,NULL,NULL),
('Hol',480,NULL,NULL,NULL,NULL,NULL),
('Hoogeveen',830,NULL,NULL,NULL,NULL,NULL),
('Høvåg, Agerøen',NULL,'Agerøen, Høvåg','Aust-Agder','Norge','Agerøen, Høvåg',NULL),
('Klegod nysogn',NULL,'Klegod, Nysogn','Ringkøbing','Danmark','Klegod, Nysogn, Ringkøbing, Danmark',NULL),
('Klöxhult, Stenbrohult, G',NULL,'Klöxhult, Stenbrohult','Kronoberg','Sverige','Klöxhult, Stenbrohult, Kronoberg, Sverige',NULL),
('Komárom (now Komárno in Slovakia), Kingdom of Ungarn',NULL,'Komárno',NULL,'Slovakia','Komárno, Slovakia',NULL),
('Konigsberg, Ostpreußen',NULL,'Kaliningrad','Ostpreußen','Russland','Kaliningrad, Ostpreußen, Russland',NULL),
('Kooten',462,NULL,NULL,NULL,NULL,NULL),
('Košice, Košice I, Košický, Slovakia',602,NULL,NULL,NULL,NULL,NULL),
('Kramer, Bottineau, North Dakota, USA of America',628,NULL,NULL,NULL,NULL,NULL),
('Kville',509,NULL,NULL,NULL,NULL,NULL),
('Købehavn',NULL,'København',NULL,'Danmark','København, Danmark',NULL),
('Køyen Grue',NULL,'Køyen, Grue','Hedmark','Norge','Køyen, Grue',NULL),
('Langelsheim, 38685',NULL,'Langelsheim','Niedersachsen','Tyskland','Langelsheim, Niedersachsen, Tyskland',NULL),
('Larvik ?',NULL,'Larvik','Vestfold','Norge','Larvik',NULL),
('Laurvig, Noorwegen',NULL,'Larvik','Vestfold','Norge','Larvik',NULL),
('Leeuwarden',829,NULL,NULL,NULL,NULL,NULL),
('Lier',354,NULL,NULL,NULL,NULL,NULL),
('Liverpool',NULL,'Liverpool',NULL,'England','Liverpool, England',NULL),
('Ljungbytorp',510,NULL,NULL,NULL,NULL,NULL),
('Lovisenberg sykehus',NULL,'Lovisenberg sykehus, Oslo','Akershus','Norge','Lovisenberg sykehus, Oslo',NULL),
('Lynderupgaard, Lynderup sogn',NULL,'Lynderupgaard, Lynderup','Viborg','Danmark','Lynderupgaard, Lynderup, Viborg, Danmark',NULL),
('Meckelborgland i Bril',NULL,'Meckelborgland',NULL,'Nederland','Meckelborgland, Nederland',NULL),
('Modum Prestegård, Modum',NULL,'Modum prestegård, Modum','Buskerud','Norge','Modum prestegård, Modum',NULL),
('Mysen',569,NULL,NULL,NULL,NULL,NULL),
('Mückenberg',759,NULL,NULL,NULL,NULL,NULL),
('Nesmoen Grue',NULL,'Nesmoen, Grue','Hedmark','Norge','Nesmoen, Grue',NULL),
('Neustadt in Oberschlesien',NULL,'Prudnik','Schlesien','Polen','Prudnik, Schlesien, Polen',NULL),
('Norderhaug',363,NULL,NULL,NULL,NULL,NULL),
('Norrunga',330,NULL,NULL,NULL,NULL,NULL),
('Oslo fylke, Oslo domkirke/Vår Frelser menighed',NULL,'Oslo domkirke, Oslo','Akershus','Norge','Oslo domkirke, Oslo',NULL),
('Petruskirken Oslo',NULL,'Petruskirken, Oslo','Akershus','Norge','Petruskirken, Oslo',NULL),
('Provstgaard, Nysogn S., Hind H., r',NULL,'Provstgaard, Nysogn','Ringkøbing','Danmark','Provstgaard, Nysogn, Ringkøbing, Danmark',NULL),
('Rossinggården, Tolga',NULL,'Rossinggården, Tolga','Hedmark','Norge','Rossinggården, Tolga',NULL),
('S Hauge Gravlund, Haugesund',NULL,'Søndre Hauge gravlund, Haugesund','Rogaland','Norge','Søndre Hauge gravlund, Haugesund',NULL),
('Sakskøbing',516,NULL,NULL,NULL,NULL,NULL),
('Schloß Neuhaus, an der Elbe',798,NULL,NULL,NULL,NULL,NULL),
('Sct. Croix, De Dansk Vestindiske Øer',NULL,'St. Croix',NULL,'De amerikanske Jomfruøyene','St. Croix, De amerikanske Jomfruøyene',NULL),
('Seattle, King, Washington',757,NULL,NULL,NULL,NULL,NULL),
('Seim gamle kyrkjegard',NULL,'Seim gamle kyrkjegard, Lindås','Hordaland','Norge','Seim gamle kyrkjegard, Lindås',NULL),
('Sexbierum',466,NULL,NULL,NULL,NULL,NULL),
('Skaanevik',NULL,'Skånevik','Hordaland','Norge','Skånevik',NULL),
('Skar Øier',NULL,'Skar, Øyer','Oppland','Norge','Skar, Øyer',NULL),
('Skaramyra Grue',NULL,'Skaramyra, Grue','Hedmark','Norge','Skaramyra, Grue',NULL),
('Solbjerg',493,NULL,NULL,NULL,NULL,NULL),
('Stiens',465,NULL,NULL,NULL,NULL,NULL),
('Storkvikne Orkdalen Sör Tröndelag',NULL,'Storkvikne, Orkdal','Sør-Trøndelag','Norge','Storkvikne, Orkdal',NULL),
('Strandby (Gislum',NULL,'Strandby, Gislum','Aalborg','Danmark','Strandby, Gislum, Aalborg, Danmark',NULL),
('Styrkesnes Indre I Sørfold',NULL,'Indre Styrkesnes, Sørfold','Nordland','Norge','Indre Styrkesnes, Sørfold',NULL),
('Sønder Alslev Kirke',NULL,'Sønder Alslev kirke','Maribo','Danmark','Sønder Alslev kirke, Maribo, Danmark',NULL),
('Sørskogsbygda, Hedemark',818,NULL,NULL,NULL,NULL,NULL),
('Trondheim katedralskole',NULL,'Trondheim katedralskole, Trondheim','Sør-Trøndelag','Norge','Trondheim katedralskole, Trondheim',NULL),
('Ungar.-Hradisch',NULL,'Uherské Hradiště','Mähren','Tsjekkia','Uherské Hradiště, Mähren, Tsjekkia',NULL),
('Ungarisch-Ostra',NULL,'Uherský Ostroh','Mähren','Tsjekkia','Uherský Ostroh, Mähren, Tsjekkia',NULL),
('Utrecht, The Nederland',804,NULL,NULL,NULL,NULL,NULL),
('Vardal',422,NULL,NULL,NULL,NULL,NULL),
('Vennergaard, Velling',NULL,'Vennergaard, Velling','Ringkøbing','Danmark','Vennergaard, Velling, Ringkøbing, Danmark',NULL),
('Vestre Fredrikstad',NULL,'Vestre Fredrikstad','Østfold','Norge','Vestre Fredrikstad',NULL),
('Viker Asmaløy Hvaler Østfold',NULL,'Viker, Asmaløy, Hvaler','Østfold','Norge','Viker, Asmaløy, Hvaler',NULL),
('Vilniaus arkikatedra',NULL,'Vilnius-katedralen, Vilnius',NULL,'Litauen','Vilnius-katedralen, Vilnius, Litauen',NULL),
('Weißenfels, Trondheim, D',742,NULL,NULL,NULL,NULL,NULL),
('Ytstereitane (1-9), Dravlaus',NULL,'Ytstereitane, Dravlaus',NULL,'Norge','Ytstereitane, Dravlaus',NULL),
('Zuidlaren',828,NULL,NULL,NULL,NULL,NULL),
('Zwaagwesteinde',469,NULL,NULL,NULL,NULL,NULL),
('ringkoebing, Hind, Nysogn, Synder Lyngvig, 2',NULL,'Søndre Lyngvig, Nysogn','Ringkøbing','Danmark','Søndre Lyngvig, Nysogn, Ringkøbing, Danmark',NULL),
('Øiestad',NULL,'Øyestad','Aust-Agder','Norge','Øyestad',NULL),
('Øiestad kirkegård',NULL,'Øyestad','Aust-Agder','Norge','Øyestad',NULL),
('Øksnes',487,NULL,NULL,NULL,NULL,NULL),
('Ørkedalen',NULL,'Orkdal','Sør-Trøndelag','Norge','Orkdal',NULL),
('Østre Bön, Tøcksmark',515,NULL,NULL,NULL,NULL,NULL),
('Ryk',NULL,'Ryk','Bohuslän','Sverige','Ryk, Bohuslän, Sverige',NULL),
('''Morvik,',NULL,'Morvik','Hordaland','Norge','Morvik',NULL),
('Aalum opsl 35/183',NULL,'Aalum','Viborg','Danmark','Aalum, Viborg, Danmark','Kirkebok: opslag 35/183.'),
('Alslevgaard',NULL,'Alslevgaard','Holstein','Tyskland','Alslevgaard, Holstein, Tyskland',NULL),
('Granselv',NULL,'Granselv','Hordaland','Norge','Granselv',NULL),
('Gården Fosseli',NULL,'Fosseli, Øyestad','Aust-Agder','Norge','Fosseli, Øyestad',NULL),
('Indre Fet',NULL,'Indre Fet','Hordaland','Norge','Indre Fet',NULL),
('Midtschoug,',NULL,'Midtskogen, Grue Finnskog','Hedmark','Norge','Midtskogen, Grue Finnskog',NULL),
('Nordreaasplads,',NULL,'Nordreaasplads','Akershus','Norge','Nordreaasplads',NULL),
('Ousby',NULL,'Ousby','Kristianstad','Sverige','Ousby, Kristianstad, Sverige',NULL),
('Ris kirkegård',NULL,'Ris kirkegård, Oslo','Akershus','Norge','Ris kirkegård, Oslo',NULL),
('Rud Høland Akershus 03.02.',NULL,'Rud, Høland','Akershus','Norge','Rud, Høland',NULL),
('Ryk Mellangård',NULL,'Ryk Mellangård','Bohuslän','Sverige','Ryk Mellangård, Bohuslän, Sverige',NULL),
('Skanderborg S.- Hjelmslev H.- Skanderborg A.',NULL,'Skanderborg','Skanderborg','Danmark','Skanderborg, Danmark','Trolig Skanderborg slott.'),
('Valberget',NULL,'Valberget','Värmland','Sverige','Valberget, Värmland, Sverige',NULL),
('Helle',NULL,'Helle','Värmland','Sverige','Helle, Värmland, Sverige',NULL),
('Forlis på reise til/fra Trondheim',NULL,'På sjøen mellom Bergen og Trondheim',NULL,'Norge','På sjøen mellom Bergen og Trondheim','Omkom ved forlis som styrmann.'),
('Hjemme',NULL,'Stavern','Vestfold','Norge','Stavern',NULL),
('Jylland?, Danmark?',NULL,'Jylland',NULL,'Danmark','Jylland, Danmark','Usikkert sted i kilden («Jylland?, Danmark?»).'),
('King of Polen',NULL,'Vilnius-katedralen, Vilnius',NULL,'Litauen','Vilnius-katedralen, Vilnius, Litauen',NULL),
('Lostorp',NULL,'Lostorp','Kristianstad','Sverige','Lostorp, Kristianstad, Sverige',NULL),
('Ryde og senere Nakskov',NULL,'Ryde, Lolland','Maribo','Danmark','Ryde, Lolland, Maribo, Danmark','Senere flyttet til Nakskov.'),
('Sunnmøre',NULL,'Sunnmøre','Møre og Romsdal','Norge','Sunnmøre',NULL),
('Vestindien',NULL,'Jomfruøyene',NULL,'De amerikanske Jomfruøyene','Jomfruøyene, De amerikanske Jomfruøyene','Kilden sier bare «Vestindien» – trolig Dansk Vestindia.'),
('kapellet under koret',NULL,'Strandby kirke, Vesthimmerland','Aalborg','Danmark','Strandby kirke, Vesthimmerland, Aalborg, Danmark','Gravkapellet under koret (sannsynlig – avledet av fødested og dødssted i Strandby).');

-- Nye steder (ett per visningsnavn; finnes navnet i samme land fra før, brukes det)
UPDATE _m m SET target = a.id FROM addresses a
WHERE m.target IS NULL AND a.country = m.country AND lower(coalesce(a.name_display, '')) = lower(m.disp);
INSERT INTO addresses (city, locality, county, country, name_short, name_display, granularity, needs_review, notes, place_raw)
SELECT DISTINCT ON (lower(disp), country)
  CASE WHEN position(', ' IN name) > 0 THEN split_part(name, ', ', 2) ELSE name END,
  CASE WHEN position(', ' IN name) > 0 THEN split_part(name, ', ', 1) END,
  region, country, split_part(name, ', ', 1), disp,
  CASE WHEN position(', ' IN name) > 0 THEN 'locality' ELSE 'city' END, true,
  'stedsvask8:' || lower(disp), raw
FROM _m WHERE target IS NULL;
UPDATE _m m SET target = a.id FROM addresses a WHERE m.target IS NULL AND a.notes = 'stedsvask8:' || lower(m.disp);
UPDATE addresses SET notes = 'Opprettet ved stedsgjennomgang 21.10.2026 – mangler koordinater' WHERE notes LIKE 'stedsvask8:%';

ALTER TABLE public.person_facts DISABLE TRIGGER audit_person_facts;
UPDATE person_facts f SET place_id = m.target,
  notes = CASE WHEN m.note IS NULL THEN f.notes WHEN f.notes IS NULL OR f.notes = '' THEN m.note
               WHEN position(m.note IN f.notes) > 0 THEN f.notes ELSE f.notes || ' ' || m.note END
FROM _m m WHERE f.place_raw = m.raw AND m.target IS NOT NULL;
ALTER TABLE public.person_facts ENABLE TRIGGER audit_person_facts;
UPDATE families fam SET marr_place_id = m.target FROM _m m WHERE fam.marr_place_raw = m.raw AND m.target IS NOT NULL;
INSERT INTO place_aliases (name_variant, canonical_name, modern_country, address_id)
SELECT m.raw, coalesce(a.name_display, a.name_short, a.city), a.country, a.id FROM _m m JOIN addresses a ON a.id = m.target
ON CONFLICT (name_variant) DO UPDATE SET address_id = EXCLUDED.address_id, canonical_name = EXCLUDED.canonical_name;
INSERT INTO person_audit_log (person_id, changed_by, change_type, table_name, note)
SELECT DISTINCT f.person_id, 'claude', 'update', 'person_facts', 'Sted koblet etter manuell gjennomgang: «' || f.place_raw || '» → ' || coalesce(a.name_display, a.name_short)
FROM person_facts f JOIN _m m ON m.raw = f.place_raw JOIN addresses a ON a.id = m.target;

-- Maren Pedersdatter: kirkebokas gravlegging 24.12.1693 (med side-henvisning) veier tyngre enn 1683 fra finnholbek.dk
UPDATE person_facts SET date_text = 'DEC 1693', date_year = 1693, date_month = 12, date_day = NULL,
  notes = 'Rettet tilbake til 1693: gravlagt 24.12.1693 i Aalum ifølge kirkeboka (opslag 35/183). finnholbek.dk oppgir 1683, trolig skrivefeil.'
WHERE person_id = 'I502041' AND fact_type = 'DEAT';

-- Hjemmevielse i Stavern (Carl Ditlev Eberhardt og Anne Farup, 1774)
INSERT INTO person_audit_log (person_id, changed_by, change_type, table_name, note) VALUES
 ('I501012','claude','update','families','Vielse 1774 «Hjemme» satt til Stavern: hjemmevielse, sannsynligvis i Fredriksvern der han var auditør ved verftet og alle barna ble født.'),
 ('I501013','claude','update','families','Vielse 1774 «Hjemme» satt til Stavern: hjemmevielse, sannsynligvis i Fredriksvern.');

-- Carl Schmettow (1817–1858): fransk krigstjeneste til karrieren, feil hendelsestype fjernes
INSERT INTO person_work_experience (person_id, employer, title, place, notes)
SELECT 'I501150', 'Den franske hær', 'Frivillig', 'Alger, Algerie',
  'Ubekreftet – ingen kilde funnet. Mulig forveksling med bestefaren, general Carl von Schmettow (1744–1821), som tjenestegjorde i Frankrike fra 1763.'
WHERE NOT EXISTS (SELECT 1 FROM person_work_experience WHERE person_id = 'I501150' AND employer = 'Den franske hær');
DELETE FROM person_facts WHERE person_id = 'I501150' AND fact_type = 'NATU' AND place_raw = 'Frivillig i fransk krigstjeneste i Alger';

-- Elofsbyn: bosted, ikke vielsessted (Per Andersson og Ingeborg Bryngelsdotter)
INSERT INTO addresses (city, locality, county, country, name_short, name_display, granularity, needs_review, notes, place_raw)
SELECT 'Östervallskog', 'Elofsbyn', 'Värmland', 'Sverige', 'Elofsbyn', 'Elofsbyn, Östervallskog, Värmland, Sverige', 'locality', true,
       'Opprettet ved stedsgjennomgang 21.10.2026 – mangler koordinater', 'Bosatt på Elofsbyn'
WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE name_display = 'Elofsbyn, Östervallskog, Värmland, Sverige');
INSERT INTO address_periods (address_id, entity_type, entity_id, period_type, notes, source_type)
SELECT a.id, 'person', p.pid, 'residence', 'Fra kilden: «Bosatt på Elofsbyn»', 'gedcom'
FROM addresses a, (VALUES ((SELECT husband_id FROM families WHERE family_id = 'F500540')), ((SELECT wife_id FROM families WHERE family_id = 'F500540'))) p(pid)
WHERE a.name_display = 'Elofsbyn, Östervallskog, Värmland, Sverige' AND p.pid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM address_periods x WHERE x.address_id = a.id AND x.entity_id = p.pid);

-- Dansk Vestindia: St. Thomas (1672), St. Jan (1718), St. Croix (1733), solgt til USA 31.3.1917.
-- Dagens land er De amerikanske Jomfruøyene; tidsdataene gir «den gang Dansk Vestindia».
INSERT INTO polities (name, description) VALUES
 ('Dansk Vestindia (Danmark-Norge)', 'Dansk-norsk koloni i Karibia: St. Thomas (1672), St. Jan (1718) og St. Croix (kjøpt fra Frankrike 1733). Sukkerplantasjer drevet med slavearbeid.'),
 ('Dansk Vestindia (Danmark)', 'Dansk koloni etter 1814, solgt til USA for 25 millioner dollar 31. mars 1917. Slaveriet ble opphevet i 1848.')
ON CONFLICT (name) DO NOTHING;
INSERT INTO place_jurisdictions (country, region, valid_from, valid_to, polity_id)
SELECT 'De amerikanske Jomfruøyene', NULL, v.f, v.t, p.id FROM (VALUES (1672, 1813, 'Dansk Vestindia (Danmark-Norge)'), (1814, 1916, 'Dansk Vestindia (Danmark)')) v(f, t, n)
JOIN polities p ON p.name = v.n
WHERE NOT EXISTS (SELECT 1 FROM place_jurisdictions j WHERE j.country = 'De amerikanske Jomfruøyene' AND j.polity_id = p.id);
INSERT INTO place_name_periods (modern_name, country, historical_name, valid_from, valid_to, note)
SELECT 'Jomfruøyene', 'De amerikanske Jomfruøyene', 'Dansk Vestindia', 1672, 1916, NULL
WHERE NOT EXISTS (SELECT 1 FROM place_name_periods WHERE modern_name = 'Jomfruøyene');
UPDATE addresses SET country = 'De amerikanske Jomfruøyene', county = NULL, historical_region = 'Dansk Vestindia',
  name_display = coalesce(name_short, city) || ', De amerikanske Jomfruøyene'
WHERE coalesce(county, historical_region) IN ('Dansk Vestindia', 'De Dansk Vestindiske Øer') OR city IN ('St. Croix', 'Sct. Croix', 'St. Thomas', 'St. Jan');

-- Sjekk av fylke/land: regionen viser hvilket land stedet ligger i
UPDATE addresses SET country = 'Danmark' WHERE country IN ('Norge','Sverige','USA')
  AND coalesce(county, historical_region) IN ('Midtjylland','Nordjylland','Sjælland','Hovedstaden','Syddanmark','Region of Southern Danmark',
    'Ringkøbing','Ringkobing','Viborg','Aalborg','Maribo','Præstø','Frederiksborg','Odense','Svendborg','Skanderborg','Sønderjylland','Fyn','Jylland','Lolland','Falster');
UPDATE addresses SET country = 'Sverige' WHERE country IN ('Norge','Danmark')
  AND coalesce(county, historical_region) IN ('Värmland','Jämtland','Bohuslän','Skåne','Kristianstad','Västra Götaland','Norrbotten','Älvsborg','Alvsborg');
UPDATE addresses SET country = 'Tyskland' WHERE country IN ('Norge','Danmark','Sverige')
  AND coalesce(county, historical_region) IN ('Sachsen','Brandenburg','Bayern','Mecklenburg','Niedersachsen','Hessen','Thüringen');
UPDATE addresses SET county = NULL WHERE country = 'Norge' AND county = 'Norge';

COMMIT;

SELECT (SELECT count(*) FROM person_facts WHERE place_raw IS NOT NULL) hendelser_med_sted,
       (SELECT count(*) FROM person_facts WHERE place_id IS NOT NULL) koblet,
       (SELECT count(*) FROM person_facts WHERE place_raw IS NOT NULL AND place_id IS NULL) ukoblet,
       (SELECT count(*) FROM families WHERE marr_place_raw IS NOT NULL AND marr_place_id IS NULL) vielser_ukoblet,
       (SELECT count(*) FROM addresses WHERE coordinates_lat IS NULL) uten_koordinater;
