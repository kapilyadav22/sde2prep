import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFolder,fetchFolder,validRange,fileEndpoint,FOLDER_ID} from '../server/drive-library.mjs';
const entry=(id,name,mime='application/octet-stream',url=`https://drive.google.com/file/d/${id}/view`)=>`<div class="flip-entry" id="entry-${id}"><a href="${url}"><img src="https://drive-thirdparty.googleusercontent.com/16/type/${mime}"><div class="flip-entry-title">${name}</div></a></div>`;
const folder=body=>`<div class="flip-entries">${body}</div>`;
test('live folder detects PDF, Markdown, Word, native Docs and preserves names safely',()=>{
 const html=folder(entry('pdf','AWS &amp; HLD.pdf')+entry('md','Patterns.md','text/plain')+entry('word','Java.docx')+entry('old','Legacy.doc')+entry('native','Kafka','application/vnd.google-apps.document','https://docs.google.com/document/d/native/edit')+entry('skip','binary.exe'));
 const files=parseFolder(html);
 assert.deepEqual(files.map(f=>f.kind),['pdf','markdown','docx','doc','gdoc']);assert.equal(files[0].title,'AWS & HLD');assert.equal(files.length,5);
 assert.throws(()=>parseFolder('<html>Sign in</html>'),/unavailable/);
});
test('folder traversal includes subfolders once and rejects failed reads',async()=>{
 const responses=new Map([[FOLDER_ID,folder(entry('child','Java','application/vnd.google-apps.folder','https://drive.google.com/drive/folders/child')+entry('one','One.pdf'))],['child',folder(entry('two','Two.md')+entry(FOLDER_ID,'Parent','application/vnd.google-apps.folder',`https://drive.google.com/drive/folders/${FOLDER_ID}`))]]);
 const files=await fetchFolder(async url=>new Response(responses.get(new URL(url).searchParams.get('id'))));
 assert.deepEqual(files.map(f=>f.id),['one','two']);assert.equal(files[1].topic,'Java');
 await assert.rejects(fetchFolder(async()=>new Response('',{status:403})),/could not be read/);
});
test('downloads use fixed Google hosts and accept only single byte ranges',()=>{
 assert.equal(validRange('bytes=0-1023'),true);assert.equal(validRange('bytes=1024-'),true);assert.equal(validRange('bytes=-1024'),true);
 assert.equal(validRange('bytes=0-1,2-3'),false);assert.equal(validRange('garbage'),false);
 assert.equal(new URL(fileEndpoint({kind:'pdf',id:'abc'})).hostname,'drive.usercontent.google.com');
 assert.equal(new URL(fileEndpoint({kind:'gdoc',id:'abc'})).hostname,'docs.google.com');
});
