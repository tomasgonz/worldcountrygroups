"""FastAPI application for country groups API."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query

from .core import get_registry
from .models import Country, CountryMembership, GroupSummary, Group

app = FastAPI(title="Country Groups API", version="0.1.0")


@app.get("/groups", response_model=list[GroupSummary])
def list_groups() -> list[GroupSummary]:
    """List all country groups (summaries without country lists)."""
    return get_registry().list_summaries()


@app.get("/groups/{gid}", response_model=Group)
def get_group(gid: str) -> Group:
    """Get a full group with its country list."""
    group = get_registry().get_group(gid)
    if group is None:
        raise HTTPException(status_code=404, detail=f"Group '{gid}' not found")
    return group


@app.get("/groups/{gid}/countries", response_model=list[Country])
def get_group_countries(gid: str) -> list[Country]:
    """Get the countries in a group."""
    countries = get_registry().get_countries(gid)
    if countries is None:
        raise HTTPException(status_code=404, detail=f"Group '{gid}' not found")
    return countries


@app.get("/countries/{iso}", response_model=CountryMembership)
def get_country(iso: str) -> CountryMembership:
    """Get which groups a country belongs to, looked up by ISO2 or ISO3 code."""
    membership = get_registry().get_country_membership(iso)
    if membership is None:
        raise HTTPException(status_code=404, detail=f"Country '{iso}' not found")
    return membership


@app.get("/search", response_model=list[GroupSummary])
def search_groups(
    q: str | None = Query(default=None, description="Text search in names/descriptions"),
    country: str | None = Query(default=None, description="Filter by country name or ISO code"),
    domain: str | None = Query(default=None, description="Filter by domain"),
) -> list[GroupSummary]:
    """Search and filter groups."""
    registry = get_registry()
    groups = registry.search_groups(q=q, country=country, domain=domain)
    return [registry.get_summary(g) for g in groups]
