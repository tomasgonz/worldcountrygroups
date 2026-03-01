"""CLI entry point for countrygroups."""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(prog="countrygroups", description="Country Groups CLI")
    subparsers = parser.add_subparsers(dest="command")

    serve_parser = subparsers.add_parser("serve", help="Start the API server")
    serve_parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    serve_parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")

    args = parser.parse_args()

    if args.command == "serve":
        try:
            import uvicorn
        except ImportError:
            print("Error: uvicorn is required. Install with: pip install countrygroups[api]", file=sys.stderr)
            sys.exit(1)
        uvicorn.run("countrygroups.api:app", host=args.host, port=args.port)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
