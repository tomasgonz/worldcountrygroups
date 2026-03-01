"""Tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from countrygroups.api import app

client = TestClient(app)


def test_list_groups():
    resp = client.get("/groups")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 46
    # Should be summaries (no 'countries' key)
    assert "countries" not in data[0]
    assert "country_count" in data[0]


def test_get_group():
    resp = client.get("/groups/eu")
    assert resp.status_code == 200
    data = resp.json()
    assert data["gid"] == "eu"
    assert data["name"] == "European Union"
    assert "countries" in data
    assert len(data["countries"]) == 27


def test_get_group_not_found():
    resp = client.get("/groups/nonexistent")
    assert resp.status_code == 404


def test_get_group_countries():
    resp = client.get("/groups/brics/countries")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    names = {c["name"] for c in data}
    assert "Brazil" in names


def test_get_group_countries_not_found():
    resp = client.get("/groups/nonexistent/countries")
    assert resp.status_code == 404


def test_get_country():
    resp = client.get("/countries/BR")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Brazil"
    assert data["iso2"] == "BR"
    assert len(data["groups"]) > 0


def test_get_country_iso3():
    resp = client.get("/countries/BRA")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Brazil"


def test_get_country_not_found():
    resp = client.get("/countries/XX")
    assert resp.status_code == 404


def test_search_by_text():
    resp = client.get("/search", params={"q": "european"})
    assert resp.status_code == 200
    data = resp.json()
    gids = [g["gid"] for g in data]
    assert "eu" in gids


def test_search_by_country():
    resp = client.get("/search", params={"country": "Brazil"})
    assert resp.status_code == 200
    data = resp.json()
    gids = [g["gid"] for g in data]
    assert "brics" in gids


def test_search_by_domain():
    resp = client.get("/search", params={"domain": "Europe"})
    assert resp.status_code == 200
    data = resp.json()
    gids = [g["gid"] for g in data]
    assert "eu" in gids


def test_search_no_params():
    resp = client.get("/search")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 46
