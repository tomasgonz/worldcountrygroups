# worldcountrygroups

Query international country groupings (EU, BRICS, G20, NATO, etc.) with 46 built-in group definitions.

## Installation

```bash
pip install worldcountrygroups          # core library only
pip install worldcountrygroups[api]     # with FastAPI server
```

## Python API

```python
import worldcountrygroups

# List all group IDs
worldcountrygroups.list_groups()  # ['acd', 'acp', ..., 'zangger']

# Get a group with full details
group = worldcountrygroups.get_group("brics")
print(group.name)           # "BRICS"
print(group.country_count)  # 5

# Get countries in a group
countries = worldcountrygroups.get_countries("eu")
print(len(countries))       # 27

# Search groups by country, domain, or text
worldcountrygroups.search_groups(country="Brazil")    # groups containing Brazil
worldcountrygroups.search_groups(domain="Africa")     # groups in Africa domain
worldcountrygroups.search_groups(q="european")        # text search
```

## API Server

```bash
worldcountrygroups serve --port 8000
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
