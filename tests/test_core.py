"""Tests for GroupRegistry and public API."""

import worldcountrygroups
from worldcountrygroups.core import GroupRegistry


def test_list_groups():
    groups = worldcountrygroups.list_groups()
    assert isinstance(groups, list)
    assert len(groups) == 46
    assert groups == sorted(groups)
    assert "eu" in groups
    assert "brics" in groups
    assert "nato" in groups


def test_get_group():
    group = worldcountrygroups.get_group("eu")
    assert group is not None
    assert group.gid == "eu"
    assert group.name == "European Union"
    assert group.country_count == 27


def test_get_group_case_insensitive():
    group = worldcountrygroups.get_group("EU")
    assert group is not None
    assert group.gid == "eu"


def test_get_group_not_found():
    assert worldcountrygroups.get_group("nonexistent") is None


def test_get_countries():
    countries = worldcountrygroups.get_countries("brics")
    assert countries is not None
    assert len(countries) == 5
    names = {c.name for c in countries}
    assert "Brazil" in names
    assert "China" in names


def test_get_countries_not_found():
    assert worldcountrygroups.get_countries("nonexistent") is None


def test_search_by_country_name():
    results = worldcountrygroups.search_groups(country="Brazil")
    assert len(results) > 0
    gids = [g.gid for g in results]
    assert "brics" in gids
    assert "g20" in gids


def test_search_by_iso2():
    results = worldcountrygroups.search_groups(country="BR")
    gids = [g.gid for g in results]
    assert "brics" in gids


def test_search_by_iso3():
    results = worldcountrygroups.search_groups(country="BRA")
    gids = [g.gid for g in results]
    assert "brics" in gids


def test_search_by_domain():
    results = worldcountrygroups.search_groups(domain="Europe")
    assert len(results) > 0
    gids = [g.gid for g in results]
    assert "eu" in gids


def test_search_by_text():
    results = worldcountrygroups.search_groups(q="european")
    assert len(results) > 0
    gids = [g.gid for g in results]
    assert "eu" in gids


def test_registry_singleton():
    r1 = worldcountrygroups.core.get_registry()
    r2 = worldcountrygroups.core.get_registry()
    assert r1 is r2


def test_registry_list_summaries():
    reg = GroupRegistry()
    summaries = reg.list_summaries()
    assert len(summaries) == 46
    for s in summaries:
        assert s.country_count >= 0


def test_country_membership():
    reg = GroupRegistry()
    membership = reg.get_country_membership("BR")
    assert membership is not None
    assert membership.name == "Brazil"
    assert membership.iso2 == "BR"
    assert membership.iso3 == "BRA"
    gids = [g.gid for g in membership.groups]
    assert "brics" in gids


def test_country_membership_iso3():
    reg = GroupRegistry()
    membership = reg.get_country_membership("BRA")
    assert membership is not None
    assert membership.name == "Brazil"


def test_country_membership_not_found():
    reg = GroupRegistry()
    assert reg.get_country_membership("XX") is None
