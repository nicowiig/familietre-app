-- ============================================================
-- Navnestandard 21.10.2026 (del 5)
--
-- Regler (avtalt med Nicolay):
--  1. Fyrstelige har ikke etternavn. Visningsnavn = fornavn [ordenstall] «av» territorium
--     (fødselsrike; regenter: riket de styrte). Dynastiet lagres separat i persons.dynasty
--     og vises som «Huset X». Danmark-Norges konger står uten territorium (Christian IV).
--  2. Norske eksonymer (Sachsen, Polen, Böhmen, Østerrike, Braunschweig), aldri engelsk.
--  3. Kjente tilnavn (den skjeggete, Hårfagre) i nytt felt person_names.epithet og vises i navnet:
--     «Hertug Georg den skjeggete av Sachsen». Familiekallenavn (Greta, Nikken) i nickname, vises ikke i navnet.
--  4. Romertall for ordenstall. Navnebrødre skilles med årstall, ikke tall i navnet.
--  5. Gammel form bevares som alternativt navn (søkbart, ikke vist som hovednavn).
--  Titulert adel med ekte slektsnavn (Schmettow, Trampe, Løvendal, Gyldenløve) beholder etternavnet.
-- ============================================================
BEGIN;

ALTER TABLE public.persons ADD COLUMN IF NOT EXISTS dynasty text;
ALTER TABLE public.person_names ADD COLUMN IF NOT EXISTS epithet text;
COMMENT ON COLUMN public.person_names.epithet IS 'Historisk tilnavn som er del av navnet (Hårfagre, den skjeggete). Vises etter fornavnet.';
COMMENT ON COLUMN public.persons.dynasty IS 'Fyrstehus/dynasti (Oldenburg, Wettin …) for personer uten etternavn. Vises som «Huset X».';

CREATE TEMP TABLE _nm (pid text, given text, middle text, prefix text, surname text, nickname text, dynasty text) ON COMMIT DROP;
INSERT INTO _nm VALUES
  ('I501809','Elisabeth',NULL,'av','Anhalt-Zerbst',NULL,'Askanier'),
  ('I501577','Joachim Ernst',NULL,'av','Brandenburg-Ansbach',NULL,'Hohenzollern'),
  ('I501575','Christian',NULL,'av','Brandenburg-Bayreuth',NULL,'Hohenzollern'),
  ('I501573','Johann',NULL,'av','Brandenburg-Küstrin',NULL,'Hohenzollern'),
  ('I502386','Sophie Amalie',NULL,'av','Braunschweig-Lüneburg',NULL,'Welf'),
  ('I501574','Katharina',NULL,'av','Braunschweig-Wolfenbüttel',NULL,'Welf'),
  ('I501405','Anna Kathrine',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501406','Sophie Elisabeth',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501407','Leonora Christina',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501408','Elisabeth Augusta',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501409','Hedevig',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501410','Christiane',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501411','Marie Cathrine',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501438','Valdemar Christian',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501439','Dorothea Elisabeth',NULL,'av','Slesvig og Holsten',NULL,NULL),
  ('I501417','Anna',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I502134','Elisabeth',NULL,'av','Østerrike',NULL,'Habsburg'),
  ('I502270','Albrecht II',NULL,'av','Østerrike','den storsinnede','Habsburg'),
  ('I502272','Anna',NULL,'av','Østerrike',NULL,'Habsburg'),
  ('I502273','Ladislaus',NULL,'av','Østerrike','Postumus','Habsburg'),
  ('I502302','Albrecht IV',NULL,'av','Østerrike','den tålmodige','Habsburg'),
  ('I502305','Georg',NULL,'av','Østerrike',NULL,'Habsburg'),
  ('I502304','Margareta',NULL,'av','Østerrike',NULL,'Habsburg'),
  ('I501398','Anna Katharina',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501542','Joachim Friedrich',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501544','Johann Sigismund',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501545','Johann Georg',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501546','Barbara Sophie',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501547','Christian Wilhelm',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501571','Johann Georg',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501576','Magdalena',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501578','Agnes',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501579','Elisabeth Sophie',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501738','Elisabeth',NULL,'av','Brandenburg-Küstrin',NULL,'Hohenzollern'),
  ('I501739','August',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501756','Joachim I',NULL,'av','Brandenburg','Nestor','Hohenzollern'),
  ('I501761','Margarete',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501786','Joachim II',NULL,'av','Brandenburg','Hector','Hohenzollern'),
  ('I501788','Barbara',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501789','Elisabeth',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501790','Sabina',NULL,'av','Brandenburg-Ansbach',NULL,'Hohenzollern'),
  ('I501791','Friedrich',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501792','Georg',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501793','Albrecht',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501794','Paul',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501797','Georg Albrecht',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501799','Johann',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501801','Magdalena Sabina',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501803','Erdmuthe',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501805','Marie',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501807','Hedwig',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501810','Margarethe',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501811','Sophie',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501812','Sigismund',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501813','Friedrich',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501814','Georg Albrecht',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I502130','Sophie',NULL,'av','Brandenburg-Ansbach',NULL,'Hohenzollern'),
  ('I501543','Katharina',NULL,'av','Brandenburg-Küstrin',NULL,'Hohenzollern'),
  ('I501740','Albrecht Friedrich',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I501760','Elisabeth',NULL,'av','Brandenburg',NULL,'Hohenzollern'),
  ('I502133','Kasimir IV',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502135','Vladislav II',NULL,'av','Böhmen og Ungarn',NULL,'Jagiellon'),
  ('I502136','Jadwiga',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502137','Kasimir',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502138','Johan I Albrecht',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502139','Aleksander',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502140','Sofia',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502143','Frederik',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502145','Anna',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502146','Elisabeth',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502141','Elisabeth',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502144','Elisabeth',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502132','Barbara',NULL,'av','Polen',NULL,'Jagiellon'),
  ('I502142','Sigismund I',NULL,'av','Polen','den gamle','Jagiellon'),
  ('I501572','Sophie',NULL,'av','Liegnitz',NULL,'Piast'),
  ('I502129','Friedrich II',NULL,'av','Liegnitz',NULL,'Piast'),
  ('I502271','Elisabeth',NULL,'av','Luxemburg',NULL,'Luxemburg'),
  ('I501341','Frederik III',NULL,NULL,NULL,NULL,'Oldenburg'),
  ('I501384','Christian IV',NULL,NULL,NULL,NULL,'Oldenburg'),
  ('I501397','Frederik II',NULL,NULL,NULL,NULL,'Oldenburg'),
  ('I501470','Christian V',NULL,NULL,NULL,NULL,'Oldenburg'),
  ('I501709','Christian III',NULL,NULL,NULL,NULL,'Oldenburg'),
  ('I501400','Sophie Amalie',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501401','Elisabeth Augusta',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501416','Elisabeth',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501418','Ulrik',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501419','Johan August',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501420','Augusta',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501421','Hedvig',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501422','Hans',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501441','Ulrik',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501444','Christian',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501471','Anna Sophie',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501472','Frederikke Amalie',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501473','Wilhelmine Ernestine',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501474','Georg',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501475','Dorothea Juliane',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501476','Ulrikke Eleonora',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501548','Frederik',NULL,'av','Danmark',NULL,'Oldenburg'),
  ('I501652','Anton Günther',NULL,'av','Oldenburg',NULL,'Oldenburg'),
  ('I501757','Elisabeth',NULL,'av','Oldenburg',NULL,'Oldenburg'),
  ('I502275','Sidonie',NULL,'av','Böhmen',NULL,'Poděbrad'),
  ('I502154','Christina',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I501386','Sophie',NULL,'av','Mecklenburg-Güstrow',NULL,'Mecklenburg'),
  ('I501787','Magdalena',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502131','Georg',NULL,'av','Sachsen','den skjeggete','Wettin'),
  ('I502147','Christoph',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502151','Christoph',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502148','Johann',NULL,'av','Sachsen','den yngre','Wettin'),
  ('I502149','Wolfgang',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502153','Friedrich',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502150','Anna',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502152','Agnes',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502155','Margarethe',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I502274','Albrecht',NULL,'av','Sachsen','den modige','Wettin'),
  ('I502276','Heinrich IV',NULL,'av','Sachsen','den fromme','Wettin'),
  ('I502277','Friedrich',NULL,'av','Sachsen',NULL,'Wettin'),
  ('I500135','Anna Margrethe',NULL,NULL,'Bull','Greta',NULL),
  ('I500406','Anna Dorothea',NULL,NULL,'Colbjørnsen','Thea',NULL),
  ('I500409','Christiane Anna Catharina','Ulrichsdatter',NULL,'Mølmann','Stinchen',NULL),
  ('I502224','Anganeta',NULL,NULL,'Pedersdatter','Agnete',NULL);

-- 5. Bevar gammel form som alternativt navn
INSERT INTO person_names (person_id, name_type, given_name, middle_name, surname, prefix, nickname, is_preferred)
SELECT n.person_id, 'also_known_as', n.given_name, n.middle_name, n.surname, n.prefix, n.nickname, false
FROM person_names n JOIN _nm m ON m.pid = n.person_id
WHERE n.is_preferred
  AND NOT EXISTS (SELECT 1 FROM person_names x WHERE x.person_id = n.person_id AND NOT x.is_preferred
    AND coalesce(x.given_name,'')||coalesce(x.middle_name,'')||coalesce(x.surname,'') = coalesce(n.given_name,'')||coalesce(n.middle_name,'')||coalesce(n.surname,''));

INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
SELECT n.person_id, 'claude', 'update', 'person_names', 'navn',
  concat_ws(' ', n.given_name, n.middle_name, n.prefix, n.surname),
  concat_ws(' ', m.given, m.middle, m.prefix, m.surname),
  'Navnestandard: fornavn + «av» territorium for fyrstelige, tilnavn til kallenavnfelt'
FROM person_names n JOIN _nm m ON m.pid = n.person_id WHERE n.is_preferred;

-- Fyrstelige (med dynasti): tilnavnet blir en del av navnet. Andre: familiekallenavn.
UPDATE person_names n SET given_name = m.given, middle_name = m.middle, prefix = m.prefix, surname = m.surname,
  epithet  = CASE WHEN m.dynasty IS NOT NULL THEN m.nickname ELSE n.epithet END,
  nickname = CASE WHEN m.dynasty IS NOT NULL THEN CASE WHEN n.nickname = m.nickname THEN NULL ELSE n.nickname END
                  ELSE coalesce(m.nickname, n.nickname) END
FROM _nm m WHERE n.person_id = m.pid AND n.is_preferred;

UPDATE persons p SET dynasty = m.dynasty FROM _nm m WHERE p.person_id = m.pid AND m.dynasty IS NOT NULL;

-- Albrecht IV av Østerrike (1377–1404) var hertug, ikke konge – kongetittelen (Böhmen og Ungarn) var sønnens, Albrecht II
UPDATE person_roles r SET person_id = 'I502270'
WHERE r.person_id = 'I502302' AND r.value = 'Konge'
  AND NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = 'I502270' AND x.value = 'Konge');
DELETE FROM person_roles WHERE person_id = 'I502302' AND value = 'Konge';

COMMIT;

SELECT n.person_id, concat_ws(' ', n.given_name, n.middle_name, n.epithet, n.prefix, n.surname) AS navn, n.nickname, p.dynasty
FROM person_names n JOIN persons p USING (person_id)
WHERE n.is_preferred AND n.person_id IN ('I502131','I502132','I502142','I501384','I501421','I501786','I502270','I500135')
ORDER BY 1;
