"""Baixa fotos de demonstração para uso local, sem dependência de CDN em runtime."""

import json
import urllib.request
from pathlib import Path

ASSETS = {
    "garden.jpg": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=85&fit=crop",
    "lemons.jpg": "https://images.unsplash.com/photo-1610833805553-43556a0f821d?w=800&q=85&fit=crop",
    "tomatoes.jpg": "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800&q=85&fit=crop",
    "greens.jpg": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=85&fit=crop",
    "oranges.jpg": "https://images.unsplash.com/photo-1547514701-42782101795e?w=800&q=85&fit=crop",
    "herbs.jpg": "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&q=85&fit=crop",
}
root = Path(__file__).resolve().parents[1] / "frontend/public/assets"
for name, url in ASSETS.items():
    request = urllib.request.Request(
        url, headers={"User-Agent": "VerdePerto-Academic/1.0"}
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        content = response.read()
    (root / name).write_bytes(content)
    print(name, len(content), "bytes")
(root / "sources.json").write_text(
    json.dumps(
        {
            "license": "https://unsplash.com/license",
            "usage": "Fotografias ilustrativas; não são fotos de ofertas reais.",
            "sources": ASSETS,
        },
        indent=2,
    ),
    encoding="utf-8",
)
