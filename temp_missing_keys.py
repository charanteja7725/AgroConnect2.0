import re
from pathlib import Path
root = Path('client/src')
files = list(root.rglob('*.jsx'))
pattern = re.compile(r't\("([^"\\]+)"\)')
keys = set()
for f in files:
    text = f.read_text(encoding='utf-8')
    keys |= set(pattern.findall(text))
trans = Path('client/src/utils/translations.js').read_text(encoding='utf-8')
decl = re.findall(r'\b([A-Za-z0-9_]+):\s*"([^"\\]*)"', trans)
trans_keys = {k for k, v in decl}
missing = sorted(k for k in keys if k not in trans_keys)
print('Used keys count', len(keys))
print('Translation keys count', len(trans_keys))
print('Missing keys count', len(missing))
print('\n'.join(missing))
