#!/usr/bin/env python3
"""Make the two web copies of one real photo for NetLab (content/photos.js / content/photos.d).

  python3 scripts/photo-import.py <id> <source.jpg|png> [--commons "File:Name.jpg"] [--out public/photos]

Writes public/photos/<id>.jpg (long edge at most 1600 px) and public/photos/<id>-800.jpg (long edge at most 800 px),
both JPEG quality 82, progressive, no EXIF/GPS/ICC metadata, sRGB. Prints the w/h of the large file and a manifest
entry to paste into content/photos.d/<batch>.js (or the LOCAL list in content/photos.js). It never upscales.
Check the sizes afterwards with: node tests/photos-check.js  (large <= 400 KB, small <= 160 KB)."""
import argparse
import io
import json
import os
import re
import sys

from PIL import Image, ImageOps

LARGE, SMALL, Q = 1600, 800, 82
MAX_KB = {LARGE: 400, SMALL: 160}


def save(im, long_edge, path):
    cp = im.copy()
    if max(cp.size) > long_edge:
        cp.thumbnail((long_edge, long_edge), Image.LANCZOS)
    q = Q
    while True:   # stay under the size budget of tests/photos-check.js: lower the quality a little if needed
        buf = io.BytesIO()
        cp.save(buf, 'JPEG', quality=q, progressive=True, optimize=True)   # no exif= / icc_profile= -> metadata stripped
        if buf.tell() <= MAX_KB[long_edge] * 1024 or q <= 60:
            break
        q -= 4
    with open(path, 'wb') as f:
        f.write(buf.getvalue())
    return cp.size, buf.tell(), q


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('id')
    ap.add_argument('source')
    ap.add_argument('--commons', help='Wikimedia Commons file name, e.g. "File:Crimping-pliers-pro-RJ-0a.jpg"')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'photos'))
    a = ap.parse_args()
    if not re.fullmatch(r'[a-z0-9-]+', a.id):
        sys.exit('id must be lower-case letters, digits and -')
    if a.commons and not a.commons.startswith('File:'):
        sys.exit('--commons must start with "File:"')
    im = Image.open(a.source)
    im = ImageOps.exif_transpose(im)          # apply the camera rotation before the EXIF block is dropped
    if im.mode != 'RGB':
        im = im.convert('RGB')
    os.makedirs(a.out, exist_ok=True)
    (w, h), kb1, q1 = save(im, LARGE, os.path.join(a.out, a.id + '.jpg'))
    (sw, sh), kb2, q2 = save(im, SMALL, os.path.join(a.out, a.id + '-800.jpg'))
    print(f'{a.id}.jpg      {w}x{h}  {kb1 // 1024} KB  q{q1}')
    print(f'{a.id}-800.jpg  {sw}x{sh}  {kb2 // 1024} KB  q{q2}')
    print('w', w, 'h', h)
    entry = {'file': a.id + '.jpg', 'w': w, 'h': h, 'title': 'TODO', 'alt': 'TODO', 'labels': []}
    if a.commons:
        entry['credit'] = {'source': 'commons', 'file': a.commons}
    print('entry:', json.dumps({a.id: entry}, ensure_ascii=False))


if __name__ == '__main__':
    main()
