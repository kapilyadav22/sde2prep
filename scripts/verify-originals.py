"""Verify original source content and flow against the statically generated site."""
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
VOID_TAGS={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class NativeHTML(HTMLParser):
    def __init__(self):
        super().__init__();self.depth=0;self.current=None;self.sections=[]
        self.tags=[];self.chrome_depth=None;self.code_group=None;self.code_depth=None;self.code_wrapper_depth=None
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='div' and 'original-document' in attrs.get('class','').split():
            assert not self.depth, 'Nested source documents'
            self.depth=1;self.current={'id':attrs['data-original-tab'],'text':[],'images':[],'tables':0,'rows':0,'cells':0,'code_groups':[]};self.sections.append(self.current)
            self.tags=[]
        elif self.depth and tag=='div':self.depth+=1
        if self.depth:
            if tag not in VOID_TAGS:self.tags.append(tag)
            if self.chrome_depth is not None:return
            if attrs.get('data-source-chrome')=='true':
                self.chrome_depth=len(self.tags);return
            if 'data-native-code-start' in attrs:
                assert self.code_group is None, 'Nested native code groups'
                self.code_group={'start':int(attrs['data-native-code-start']),'end':int(attrs['data-native-code-end']),'text':[],'code_elements':0}
                self.code_wrapper_depth=len(self.tags);self.current['code_groups'].append(self.code_group)
            if self.code_group is not None and tag=='code' and 'pre' in self.tags[:-1]:
                self.code_group['code_elements']+=1;self.code_depth=len(self.tags)
            if tag=='img':self.current['images'].append(attrs['src'])
            if tag=='table':self.current['tables']+=1
            if tag=='tr':self.current['rows']+=1
            if tag in ('td','th'):self.current['cells']+=1
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID_TAGS:self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if self.depth:
            assert self.tags and self.tags[-1]==tag, f'Unbalanced source markup: {tag}'
            depth=len(self.tags)
            if self.chrome_depth==depth:self.chrome_depth=None
            if self.code_depth==depth:self.code_depth=None
            if self.code_wrapper_depth==depth:
                self.code_group=None;self.code_wrapper_depth=None
            self.tags.pop()
            if tag=='div':self.depth-=1
    def handle_data(self,data):
        if self.depth and self.chrome_depth is None:
            self.current['text'].append(data)
            if self.code_group is not None and self.code_depth is not None:self.code_group['text'].append(data)
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
def original_code_range(blocks,start,end):
    """Find an inclusive sibling range, without skipping any original block."""
    for i,b in enumerate(blocks or []):
        if b.get('startIndex')==start:
            for j in range(i,len(blocks)):
                if blocks[j].get('startIndex')==end:
                    group=blocks[i:j+1]
                    assert all(item.get('paragraph') for item in group), f'Code range includes non-paragraph source blocks: {start}–{end}'
                    parts=original_parts(group)
                    assert not parts['images'], f'Code range includes source images: {start}–{end}'
                    return ''.join(parts['text']).replace('\u000b','\n')
            raise AssertionError(f'Code range end is missing or not a sibling: {start}–{end}')
        if b.get('table'):
            for row in b['table']['tableRows']:
                for cell in row['tableCells']:
                    found=original_code_range(cell.get('content'),start,end)
                    if found is not None:return found
    return None
def verify_code_groups(section,tab):
    previous_end=-1
    for group in section['code_groups']:
        start,end=group['start'],group['end']
        label=f"{tab['title']} / {start}–{end}"
        assert start<=end and start>previous_end, f'Code ranges reordered or overlapping: {label}'
        assert group['code_elements']==1, f'Code range must contain exactly one pre/code element: {label}'
        original=original_code_range(tab['body']['content'],start,end)
        assert original is not None, f'Code range start is missing: {label}'
        assert ''.join(group['text'])==original, f'Code text or whitespace changed: {label}'
        previous_end=end
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
            verify_code_groups(section,tab)
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
