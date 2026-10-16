"""Compare the production AWS HTML with its original Google Docs snapshot."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

class OriginalHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.text = []
        self.images = []
        self.tables = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'div' and 'original-document' in attrs.get('class', '').split():
            self.depth = 1
        elif self.depth and tag == 'div':
            self.depth += 1
        if self.depth:
            if tag == 'img':
                self.images.append(attrs['src'])
            if tag == 'table':
                self.tables += 1

    def handle_endtag(self, tag):
        if self.depth and tag == 'div':
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.text.append(data)

def source_parts(blocks):
    text, images, tables = [], [], 0
    for block in blocks:
        if 'paragraph' in block:
            for item in block['paragraph'].get('elements', []):
                if 'textRun' in item:
                    text.append(item['textRun']['content'])
                if 'inlineObjectElement' in item:
                    images.append(item['inlineObjectElement']['inlineObjectId'])
        if 'table' in block:
            tables += 1
            for row in block['table']['tableRows']:
                for cell in row['tableCells']:
                    part_text, part_images, part_tables = source_parts(cell.get('content', []))
                    text.extend(part_text)
                    images.extend(part_images)
                    tables += part_tables
    return text, images, tables

normalize = lambda s: re.sub(r'\s+', '', s)
library = json.loads((ROOT / 'content/library.json').read_text())
document = json.loads((ROOT / 'content/raw/aws-native.json').read_text())
aliases = json.loads((ROOT / 'content/note-aliases.json').read_text())
counts = {'chapters': 0, 'images': 0, 'tables': 0, 'preserved_links': len(aliases)}
for note in (n for n in library['notes'] if n.get('originalTabId')):
    tab = next(t for t in document['tabs'] if t['tabId'] == note['originalTabId'])
    text, image_ids, table_count = source_parts(tab['body']['content'])
    parser = OriginalHTML()
    parser.feed((ROOT / 'out/notes' / note['id'] / 'index.html').read_text())
    assert normalize(''.join(parser.text)) == normalize(''.join(text)), f"Source text lost or reordered in {note['title']}"
    images = [tab['inlineObjects'][i]['inlineObjectProperties']['embeddedObject']['imageProperties']['localPath'] for i in image_ids]
    assert parser.images == images, f"Images missing or reordered in {note['title']}"
    assert parser.tables == table_count, f"Tables missing in {note['title']}"
    for image in images:
        assert (ROOT / 'out' / image.lstrip('/')).is_file(), f'Missing diagram file: {image}'
    counts['chapters'] += 1
    counts['images'] += len(images)
    counts['tables'] += table_count
for old, new in aliases.items():
    html = (ROOT / 'out/notes' / old / 'index.html').read_text()
    assert f'/notes/{new}/' in html and 'original-document' in html, f'Broken legacy URL: {old}'
print(json.dumps(counts))
