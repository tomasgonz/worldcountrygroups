"""Tests for Pydantic models."""

from worldcountrygroups.models import Country, Group, GroupSummary, CountryMembership


def test_country_model():
    c = Country(name="Brazil", iso2="BR", iso3="BRA")
    assert c.name == "Brazil"
    assert c.iso2 == "BR"
    assert c.iso3 == "BRA"


def test_group_model():
    g = Group(
        gid="test",
        acronym="TST",
        name="Test Group",
        description="A test group",
        classifier="Test",
        domains=["TestDomain"],
        countries=[
            Country(name="Brazil", iso2="BR", iso3="BRA"),
            Country(name="India", iso2="IN", iso3="IND"),
        ],
    )
    assert g.country_count == 2
    assert g.gid == "test"


def test_group_summary_model():
    s = GroupSummary(
        gid="test",
        acronym="TST",
        name="Test Group",
        description="A test group",
        classifier="Test",
        domains=["TestDomain"],
        country_count=5,
    )
    assert s.country_count == 5


def test_country_membership_model():
    m = CountryMembership(
        name="Brazil",
        iso2="BR",
        iso3="BRA",
        groups=[
            GroupSummary(
                gid="brics",
                acronym="BRICS",
                name="BRICS",
                description="desc",
                classifier="BRICS",
                domains=[],
                country_count=5,
            )
        ],
    )
    assert len(m.groups) == 1
    assert m.groups[0].gid == "brics"
