#!/usr/bin/env python3
import json
from pathlib import Path

files = sorted(f.name for f in Path('public/transcribes').glob('*.json') if f.name != 'manifest.json')
Path('public/transcribes/manifest.json').write_text(json.dumps(files, indent=2))
print(f'{len(files)} transcripts written to public/transcribes/manifest.json')
