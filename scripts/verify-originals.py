"""Verify original source content and flow against the statically generated site."""
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
class NativeHTML(HTMLParser):
    def __init__(self):
        super().__init__();self.depth=0;self.current=None;self.sections=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='div' and 'original-document' in attrs.get('class','').split():
            assert not self.depth, 'Nested source documents'
            self.depth=1;self.current={'id':attrs['data-original-tab'],'text':[],'images':[],'tables':0,'rows':0,'cells':0};self.sections.append(self.current)
        elif self.depth and tag=='div':self.depth+=1
        if self.depth:
            if tag=='img':self.current['images'].append(attrs['src'])
            if tag=='table':self.current['tables']+=1
            if tag=='tr':self.current['rows']+=1
            if tag in ('td','th'):self.current['cells']+=1
    def handle_endtag(self,tag):
        if self.depth and tag=='div':self.depth-=1
    def handle_data(self,data):
        if self.depth:self.current['text'].append(data)
def original_parts(blocks):
    out={'text':[],'images':[],'tables':0,'rows':0,'cells':0}
    for b in blocks or []:
        if b.get('paragraph'):
            for e in b['paragraph'].get('elements',[]):
                if e.get('textRun'):out['text'].append(e['textRun']['content'])
                if e.get('dropdown'):out['text'].append(e['dropdown'].get('dropdownProperties',{}).get('displayValue',''))
                if e.get('inlineObjectElement'):out['images'].append(e['inlineObjectElement']['inlineObjectId'])
        if b.get('table'):
            out['tables']+=1
            for row in b['table']['tableRows']:
                out['rows']+=1
                for cell in row['tableCells']:
                    out['cells']+=1;p=original_parts(cell.get('content'))
                    for key in ('text','images'):out[key].extend(p[key])
                    for key in ('tables','rows','cells'):out[key]+=p[key]
    return out
normalize=lambda s:re.sub(r'\s+','',s)
sources=json.loads((ROOT/'content/sources.json').read_text())
library=json.loads((ROOT/'content/library.json').read_text())
summary=[]
for source in (s for s in sources if s.get('nativeSnapshot')):
    doc=json.loads((ROOT/'content'/source['nativeSnapshot']).read_text());tabs={t['tabId']:t for t in doc['tabs']}
    used=[];counts=Counter(chapters=0,images=0,tables=0,rows=0,cells=0)
    for note in (n for n in library['notes'] if n['sourceId']==source['id']):
        parser=NativeHTML();parser.feed((ROOT/'out/notes'/note['id']/'index.html').read_text())
        expected=note.get('originalTabIds') or [note['originalTabId']]
        assert [s['id'] for s in parser.sections]==expected, f"Source sections reordered: {note['title']}"
        used.extend(expected);counts['chapters']+=1
        for section in parser.sections:
            tab=tabs[section['id']];original=original_parts(tab['body']['content'])
            assert normalize(''.join(section['text']))==normalize(''.join(original['text'])),f"Text lost/reordered: {source['id']} / {tab['title']}"
            images=[tab['inlineObjects'][i]['inlineObjectProperties']['embeddedObject']['imageProperties']['localPath'] for i in original['images']]
            assert section['images']==images,f"Images lost/reordered: {tab['title']}"
            for key in ('tables','rows','cells'):assert section[key]==original[key],f"Table structure lost: {tab['title']} / {key}"
            for image in images:assert (ROOT/'out'/image.lstrip('/')).is_file(),f'Missing asset: {image}'
            counts['images']+=len(images)
            for key in ('tables','rows','cells'):counts[key]+=section[key]
    assert len(used)==len(set(used)),f"Duplicate source sections: {source['id']}"
    meaningful=[t['tabId'] for t in doc['tabs'] if normalize(''.join(original_parts(t.get('body',{}).get('content'))['text'])) or original_parts(t.get('body',{}).get('content'))['images']]
    assert used==meaningful,f"Source order or coverage changed: {source['id']}"
    summary.append({'source':source['id'],'sections':len(used),**counts})
print(json.dumps(summary,indent=2))
