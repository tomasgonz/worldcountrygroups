# countrygroups

Query international country groupings (EU, BRICS, G20, NATO, etc.) with 46 built-in group definitions.

## Installation

```bash
pip install countrygroups          # core library only
pip install countrygroups[api]     # with FastAPI server
```

## Python API

```python
import countrygroups

# List all group IDs
countrygroups.list_groups()  # ['acd', 'acp', ..., 'zangger']

# Get a group with full details
group = countrygroups.get_group("brics")
print(group.name)           # "BRICS"
print(group.country_count)  # 5

# Get countries in a group
countries = countrygroups.get_countries("eu")
print(len(countries))       # 27

# Search groups by country, domain, or text
countrygroups.search_groups(country="Brazil")    # groups containing Brazil
countrygroups.search_groups(domain="Africa")     # groups in Africa domain
countrygroups.search_groups(q="european")        # text search
```

## API Server

```bash
countrygroups serve --port 8000
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/groups` | List all groups (summaries) |
| GET | `/groups/{gid}` | Get full group with countries |
| GET | `/groups/{gid}/countries` | Get countries in a group |
| GET | `/countries/{iso}` | Get group memberships for a country |
| GET | `/search?q=&country=&domain=` | Search groups |

## License

MIT
