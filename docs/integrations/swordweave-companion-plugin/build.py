"""Build the portable plugin ZIP from confirmed, non-secret listing metadata."""

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZIP_DEFLATED, ZipFile


def https_url(value):
    try:
        url = urlsplit(value)
        if (url.scheme == "https" and url.hostname and url.username is None
                and not url.fragment and not any(char.isspace() for char in value)):
            return value
    except ValueError:
        pass
    raise argparse.ArgumentTypeError("Expected an HTTPS URL without credentials or a fragment")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client-id", required=True, help="Clerk's production OAuth application ID")
    parser.add_argument("--publisher", required=True, help="Verified OpenAI publisher display name")
    parser.add_argument("--category", required=True, help="Exact category from the Plugins portal")
    parser.add_argument("--terms-url", type=https_url, required=True, help="Published SwordWeave terms")
    parser.add_argument("--recording-url", type=https_url, help="Reviewer-accessible walkthrough")
    parser.add_argument("--output", type=Path, required=True, help="Path for the new ZIP file")
    args = parser.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9_-]{1,256}", args.client_id):
        parser.error("Provide the public Clerk OAuth application ID")
    if not 1 <= len(args.publisher.strip()) <= 80 or not args.category.strip():
        parser.error("Provide the verified publisher and the portal category")

    source = Path(__file__).resolve().parent
    plugin = json.loads((source / "plugin.json").read_text(encoding="utf-8"))
    mcp = json.loads((source / "mcp.json").read_text(encoding="utf-8"))
    plugin["author"] = {"name": args.publisher, "url": plugin["homepage"]}
    extension = plugin["extensions"]["com.openai"]
    extension["interface"].update(
        developerName=args.publisher, category=args.category, termsOfServiceURL=args.terms_url,
    )
    if args.recording_url:
        extension["review"]["demo_recording_url"] = args.recording_url
    mcp["mcpServers"]["swordweave"]["extensions"]["com.openai"]["auth"]["client"]["clientId"] = args.client_id

    icon = source.parents[2] / "public" / "brand" / "swordweave-companion-icon.png"
    with ZipFile(args.output, "x", compression=ZIP_DEFLATED) as package:
        package.writestr("plugin.json", json.dumps(plugin, ensure_ascii=False, indent=2) + "\n")
        package.writestr("mcp.json", json.dumps(mcp, indent=2) + "\n")
        package.write(icon, "assets/icon.png")


if __name__ == "__main__":
    main()
