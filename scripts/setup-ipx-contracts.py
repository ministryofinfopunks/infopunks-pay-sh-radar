#!/usr/bin/env python3
"""Install the reviewed OpenZeppelin source commit without touching the application Git index."""
from pathlib import Path
import shutil
import subprocess
import tempfile
root = Path(__file__).resolve().parent.parent
expected = 'c64a1edb67b6e3f4a15cca8909c9482ad33a02b0'
destination = root / 'contracts/lib/openzeppelin-contracts'
if destination.exists():
    raise SystemExit('Dependency directory already exists; inspect it before replacing it.')
with tempfile.TemporaryDirectory(prefix='ipx-contracts-') as temporary:
    checkout = Path(temporary) / 'openzeppelin'
    subprocess.run(['git', 'clone', '--depth', '1', '--branch', 'v5.4.0', 'https://github.com/OpenZeppelin/openzeppelin-contracts.git', str(checkout)], check=True)
    actual = subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != expected:
        raise SystemExit('Dependency commit differs from the reviewed pin.')
    destination.mkdir(parents=True)
    shutil.copytree(checkout / 'contracts', destination / 'contracts')
    shutil.copy2(checkout / 'LICENSE', destination / 'LICENSE')
print('Pinned contract dependency installed.')
