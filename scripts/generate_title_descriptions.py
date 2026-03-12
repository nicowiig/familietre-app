#!/usr/bin/env python3
"""
Genererer historiske beskrivelser for titler/rang i person_roles-tabellen.

Henter alle rader der role_type IN ('title', 'nobility') og reason er tom,
sender unike (value, place)-par til Claude API med norsk prompt,
og oppdaterer reason-feltet i Supabase.

Bruk:
    python scripts/generate_title_descriptions.py [--dry-run]

Miljøvariabler som må være satt:
    ANTHROPIC_API_KEY    - Claude API-nøkkel
    SUPABASE_URL         - Supabase prosjekt-URL
    SUPABASE_SERVICE_KEY - Supabase service role key (ikke anon key)
"""

import os
import sys
import time
import argparse
import json

# Sjekk avhengigheter
try:
    import anthropic
except ImportError:
    print("Mangler anthropic-pakke. Kjør: pip install anthropic")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    print("Mangler supabase-pakke. Kjør: pip install supabase")
    sys.exit(1)


def get_env(name):
    val = os.environ.get(name)
    if not val:
        print(f"Miljøvariabel {name} er ikke satt.")
        sys.exit(1)
    return val


def generate_description(client, value, place):
    """Generer historisk beskrivelse for en tittel via Claude API."""
    context = f'tittelen "{value}"'
    if place:
        context += f' i "{place}"'

    prompt = (
        f"Beskriv på norsk (2-3 setninger) hva {context} innebar historisk, "
        f"med fokus på ansvarsområde og makt. Vær faktabasert og nøytral. "
        f"Svar kun med selve beskrivelsen, uten innledning eller avslutning."
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()


def main():
    parser = argparse.ArgumentParser(description="Generer titelbeskrivelser med Claude")
    parser.add_argument("--dry-run", action="store_true",
                        help="Vis hva som ville bli gjort uten å skrive til Supabase")
    parser.add_argument("--limit", type=int, default=None,
                        help="Maks antall unike (value, place)-par å behandle")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Sekunder mellom API-kall (standard: 0.5)")
    args = parser.parse_args()

    # Hent credentials
    anthropic_key   = get_env("ANTHROPIC_API_KEY")
    supabase_url    = get_env("SUPABASE_URL")
    supabase_key    = get_env("SUPABASE_SERVICE_KEY")

    # Koblinger
    claude  = anthropic.Anthropic(api_key=anthropic_key)
    db      = create_client(supabase_url, supabase_key)

    print("Henter titler og rang uten beskrivelse...")

    # Hent rader der role_type er title/nobility og reason er tom
    result = db.table("person_roles") \
        .select("id, value, place, reason") \
        .in_("role_type", ["title", "nobility"]) \
        .execute()

    rows = result.data or []

    # Filtrer ut de som allerede har reason
    empty_rows = [r for r in rows if not (r.get("reason") or "").strip()]
    print(f"Fant {len(rows)} titler totalt, {len(empty_rows)} uten beskrivelse.")

    if not empty_rows:
        print("Ingen titler å behandle. Avslutter.")
        return

    # Grupper etter (value, place) for å unngå duplikate API-kall
    unique_pairs = {}
    for row in empty_rows:
        key = (row["value"] or "", row["place"] or "")
        if key not in unique_pairs:
            unique_pairs[key] = []
        unique_pairs[key].append(row["id"])

    pairs_list = list(unique_pairs.items())
    if args.limit:
        pairs_list = pairs_list[:args.limit]

    print(f"Behandler {len(pairs_list)} unike (tittel, sted)-kombinasjoner...\n")

    success_count = 0
    error_count = 0

    for (value, place), row_ids in pairs_list:
        display = f'"{value}"' + (f' ({place})' if place else "")
        print(f"  → {display}")

        if args.dry_run:
            print(f"     [dry-run] Ville generert beskrivelse for {len(row_ids)} rad(er)\n")
            continue

        try:
            description = generate_description(claude, value, place or None)
            print(f"     {description[:80]}{'...' if len(description) > 80 else ''}")

            # Oppdater alle rader med denne kombinasjonen
            for row_id in row_ids:
                db.table("person_roles") \
                    .update({"reason": description}) \
                    .eq("id", row_id) \
                    .execute()

            print(f"     ✓ Oppdatert {len(row_ids)} rad(er)\n")
            success_count += 1

        except Exception as e:
            print(f"     ✗ Feil: {e}\n")
            error_count += 1

        if args.delay > 0:
            time.sleep(args.delay)

    if not args.dry_run:
        print(f"\nFerdig! {success_count} kombinasjoner oppdatert, {error_count} feil.")
    else:
        print(f"\n[dry-run] Ville behandlet {len(pairs_list)} kombinasjoner.")


if __name__ == "__main__":
    main()
