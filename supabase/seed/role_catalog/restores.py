# -*- coding: utf-8 -*-
"""
Historiske skrivemåter og roller som gikk tapt ved forrige opprydding
(funnet i person_audit_log, «Rolle slettet: …»).

(person_id, kanonisk rolle, kildens tekst, handling, ekstra)
  handling = "original": legg kildens tekst i original_value på eksisterende rad
  handling = "insert":   rollen forsvant helt – legg den inn igjen
"""

RESTORES = [
    ("I500013", "Høyesterettsadvokat", "Høiesteretsadvokat", "original", {}),
    ("I500008", "Høyesterettsadvokat", "H.r.advokat", "original", {}),
    ("I500193", "Bokholder", "Bogholder", "original", {}),
    ("I500224", "Overrettssakfører", "Overretssakfører", "original", {}),
    ("I500224", "Litterat", "Literat", "original", {}),
    ("I500225", "Sakfører", "Sagfører", "original", {}),
    ("I500134", "Fiolinist", "Violonist", "original", {}),
    ("I500134", "Komponist", "Komponist, violinvirtous (verdensberømt !)", "original", {}),
    ("I501692", "Regimentsfeltskjær", "Regimentsfeltskær og konferanseråd", "original", {}),
    ("I500025", "Bygningsinspektør", "Architect og bygnynginspektor", "original", {}),
    ("I500970", "Tømmermann", "Tømmermann,småbruker og fisker.", "original", {}),
    ("I500954", "Bonde", "Skattefränstorplsehemmansåbo", "original", {}),
    ("I502033", "Fogd", "Fogd og stiftskriver", "original", {}),
    ("I502033", "Stiftsskriver", "Fogd og stiftskriver", "original", {}),
    ("I502024", "Borgermester", "Fogd, rådmann. Borgermester i Trondheim", "original", {}),
    ("I502024", "Rådmann", "Fogd, rådmann. Borgermester i Trondheim", "insert", {"place": "Trondheim"}),
    ("I501447", "Lensmann", "Bonde och Lensmann.", "original", {}),
    ("I501447", "Bonde", "Bonde och Lensmann.", "insert", {}),
    ("I501298", "Borger", "Trondheimsborger", "insert", {"place": "Trondheim"}),
    ("I502124", "Gårdeier", "1898 ejer af Fredenslund og Ravnbjerg i Solbjerg Sogn", "insert",
     {"place": "Fredenslund og Ravnbjerg, Solbjerg sogn"}),
    ("I501863", "Kroholder", "1748 bev. på krohold i Gunderup", "insert",
     {"place": "Gunderup", "date_from": "1748"}),
    ("I502342", "Festebonde", "Finland, og blev landbonde åt adelssläkten Horn på Rautalampi", "insert",
     {"place": "Rautalampi, Finland"}),
]
