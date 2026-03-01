"""GroupRegistry: data loading and query engine with reverse indexes."""

from __future__ import annotations

import json
from pathlib import Path

from .models import Country, CountryMembership, Group, GroupSummary

DATA_DIR = Path(__file__).parent / "data" / "groups"


class GroupRegistry:
    """Loads group JSON files and provides O(1) lookups via reverse indexes."""

    def __init__(self) -> None:
        self._groups: dict[str, Group] = {}
        # Reverse indexes: iso code -> set of gids
        self._iso2_to_gids: dict[str, set[str]] = {}
        self._iso3_to_gids: dict[str, set[str]] = {}
        # Country info by iso code
        self._iso2_to_country: dict[str, Country] = {}
        self._iso3_to_country: dict[str, Country] = {}
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self._load()

    def _load(self) -> None:
        for path in sorted(DATA_DIR.glob("*.json")):
            with open(path) as f:
                data = json.load(f)
            group = Group.model_validate(data)
            self._groups[group.gid] = group
            for country in group.countries:
                iso2 = country.iso2.upper()
                iso3 = country.iso3.upper()
                self._iso2_to_gids.setdefault(iso2, set()).add(group.gid)
                self._iso3_to_gids.setdefault(iso3, set()).add(group.gid)
                self._iso2_to_country[iso2] = country
                self._iso3_to_country[iso3] = country
        self._loaded = True

    def list_groups(self) -> list[str]:
        """Return sorted list of all group IDs."""
        self._ensure_loaded()
        return sorted(self._groups.keys())

    def get_group(self, gid: str) -> Group | None:
        """Return a Group by its ID, or None if not found."""
        self._ensure_loaded()
        return self._groups.get(gid.lower())

    def get_countries(self, gid: str) -> list[Country] | None:
        """Return the country list for a group, or None if group not found."""
        self._ensure_loaded()
        group = self._groups.get(gid.lower())
        if group is None:
            return None
        return list(group.countries)

    def get_summary(self, group: Group) -> GroupSummary:
        """Convert a Group to a GroupSummary."""
        return GroupSummary(
            gid=group.gid,
            acronym=group.acronym,
            name=group.name,
            description=group.description,
            classifier=group.classifier,
            domains=group.domains,
            country_count=group.country_count,
        )

    def list_summaries(self) -> list[GroupSummary]:
        """Return summaries for all groups."""
        self._ensure_loaded()
        return [self.get_summary(g) for g in sorted(self._groups.values(), key=lambda g: g.gid)]

    def get_country_membership(self, iso: str) -> CountryMembership | None:
        """Look up a country by ISO2 or ISO3 code and return its group memberships."""
        self._ensure_loaded()
        iso_upper = iso.upper()
        # Try iso2 first, then iso3
        if iso_upper in self._iso2_to_country:
            country = self._iso2_to_country[iso_upper]
            gids = self._iso2_to_gids.get(iso_upper, set())
        elif iso_upper in self._iso3_to_country:
            country = self._iso3_to_country[iso_upper]
            gids = self._iso3_to_gids.get(iso_upper, set())
        else:
            return None
        groups = [self.get_summary(self._groups[gid]) for gid in sorted(gids)]
        return CountryMembership(
            name=country.name,
            iso2=country.iso2,
            iso3=country.iso3,
            groups=groups,
        )

    def search_groups(
        self,
        *,
        country: str | None = None,
        domain: str | None = None,
        q: str | None = None,
    ) -> list[Group]:
        """Search groups by country name/ISO, domain, or free text query."""
        self._ensure_loaded()
        results: list[Group] | None = None

        if country is not None:
            country_upper = country.upper()
            gids: set[str] = set()
            # Check if it's an ISO code
            if country_upper in self._iso2_to_gids:
                gids = self._iso2_to_gids[country_upper]
            elif country_upper in self._iso3_to_gids:
                gids = self._iso3_to_gids[country_upper]
            else:
                # Search by country name (case-insensitive)
                country_lower = country.lower()
                for group in self._groups.values():
                    for c in group.countries:
                        if country_lower in c.name.lower():
                            gids.add(group.gid)
            matched = [self._groups[gid] for gid in gids]
            results = matched if results is None else [g for g in results if g in matched]

        if domain is not None:
            domain_lower = domain.lower()
            matched = [
                g for g in self._groups.values()
                if any(domain_lower in d.lower() for d in g.domains)
            ]
            results = matched if results is None else [g for g in results if g in matched]

        if q is not None:
            q_lower = q.lower()
            matched = [
                g for g in self._groups.values()
                if q_lower in g.name.lower()
                or q_lower in g.description.lower()
                or q_lower in g.acronym.lower()
            ]
            results = matched if results is None else [g for g in results if g in matched]

        if results is None:
            results = list(self._groups.values())

        return sorted(results, key=lambda g: g.gid)


# Module-level singleton (lazy-loaded)
_registry: GroupRegistry | None = None


def get_registry() -> GroupRegistry:
    """Return the module-level singleton GroupRegistry."""
    global _registry
    if _registry is None:
        _registry = GroupRegistry()
    return _registry
