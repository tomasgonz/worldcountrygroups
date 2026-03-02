"""worldcountrygroups - Query international country groupings."""

from __future__ import annotations

from .core import get_registry
from .models import Country, CountryMembership, Group, GroupSummary

__all__ = [
    "Country",
    "CountryMembership",
    "Group",
    "GroupSummary",
    "get_countries",
    "get_group",
    "list_groups",
    "search_groups",
]


def list_groups() -> list[str]:
    """Return sorted list of all group IDs."""
    return get_registry().list_groups()


def get_group(gid: str) -> Group | None:
    """Return a Group by its ID, or None if not found."""
    return get_registry().get_group(gid)


def get_countries(gid: str) -> list[Country] | None:
    """Return the country list for a group, or None if group not found."""
    return get_registry().get_countries(gid)


def search_groups(
    *,
    country: str | None = None,
    domain: str | None = None,
    q: str | None = None,
) -> list[Group]:
    """Search groups by country name/ISO, domain, or free text query."""
    return get_registry().search_groups(country=country, domain=domain, q=q)
