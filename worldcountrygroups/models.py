"""Pydantic models for country group data."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Country(BaseModel):
    """A country with name and ISO codes."""

    name: str
    iso2: str
    iso3: str


class Group(BaseModel):
    """A country group with full member list."""

    gid: str
    acronym: str
    name: str
    description: str
    classifier: str
    domains: list[str]
    countries: list[Country]
    founded: Optional[int] = None
    headquarters: Optional[str] = None
    website: Optional[str] = None
    official_languages: Optional[list[str]] = None

    @property
    def country_count(self) -> int:
        return len(self.countries)


class GroupSummary(BaseModel):
    """A country group without the member list."""

    gid: str
    acronym: str
    name: str
    description: str
    classifier: str
    domains: list[str]
    country_count: int


class CountryMembership(BaseModel):
    """Which groups a country belongs to."""

    name: str
    iso2: str
    iso3: str
    groups: list[GroupSummary]
