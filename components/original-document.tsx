import type {CSSProperties,ReactNode} from 'react';
import type {NativeBlock,NativeTab,NativeTextStyle,NativeParagraph,NativeColor} from '@/lib/native-document';
import {headingId} from '@/lib/native-document';
import {nativeCodeGroup} from '@/lib/native-code.mjs';
import {CodeBlock} from '@/components/code-block';
import {isEmptyNativeParagraph,nativePresentation} from '@/lib/native-presentation.mjs';
import {HLD_ROADMAP_TAB_ID,roadmapStatusCell} from '@/lib/hld-roadmap.mjs';
import {RoadmapStatus} from '@/components/roadmap-status';
type Presentation=ReturnType<typeof nativePresentation>;
function color(value?:NativeColor){const rgb=value?.color?.rgbColor;if(!rgb)return undefined;return `rgb(${[rgb.red||0,rgb.green||0,rgb.blue||0].map(c=>Math.round(c*255)).join(',')})`;}
function safeLink(url?:string){return url&&/^(https?:\/\/|mailto:)/i.test(url)&&!/^https?:\/\/docs\.google\.com\//i.test(url)?url:undefined;}
function runStyle(s:NativeTextStyle={}):CSSProperties{return {fontWeight:s.bold?700:undefined,fontStyle:s.italic?'italic':undefined,textDecoration:[s.underline?'underline':'',s.strikethrough?'line-through':''].filter(Boolean).join(' ')||undefined,color:color(s.foregroundColor),backgroundColor:color(s.backgroundColor),verticalAlign:s.baselineOffset==='SUPERSCRIPT'?'super':s.baselineOffset==='SUBSCRIPT'?'sub':undefined};}
function runs(p:NativeParagraph,tab:NativeTab,heading=false):ReactNode{return (p.elements||[]).map((e,i)=>{
  if(e.dropdown?.dropdownProperties?.displayValue)return <span key={i} className="original-dropdown">{e.dropdown.dropdownProperties.displayValue}</span>;
  if(e.textRun){const {textStyle}=e.textRun;const content=e.textRun.content.replace(/\u000b/g,'\n');const link=safeLink(textStyle?.link?.url);const mono=!heading&&!textStyle?.bold&&/mono|courier|consolas/i.test(textStyle?.weightedFontFamily?.fontFamily||'');const className=mono?'original-inline-code':undefined;return link?<a key={i} href={link} className={className} target="_blank" rel="noreferrer" style={runStyle(textStyle)}>{content}</a>:<span key={i} className={className} style={runStyle(textStyle)}>{content}</span>;}
  if(e.inlineObjectElement){const image=tab.inlineObjects?.[e.inlineObjectElement.inlineObjectId]?.inlineObjectProperties?.embeddedObject;const src=image?.imageProperties?.localPath;if(!src)return null;const width=image.size?.width?.magnitude;const alt=image.title||image.description||`${tab.title} — original source diagram`;return <button key={i} type="button" className="original-image-link" data-src={src} aria-label={`Open diagram in large size: ${alt}`}><img src={src} alt={alt} loading="lazy" decoding="async" style={width?{width:Math.round(width*4/3)}:undefined}/></button>;}
  return e.horizontalRule?<hr key={i}/>:null;
});}
function paragraph(b:NativeBlock,tab:NativeTab,headingLevel?:number,suppressHeading=false){const p=b.paragraph!;const raw=/^HEADING_(\d)/.exec(p.paragraphStyle?.namedStyleType||'');const level=suppressHeading?0:headingLevel||(raw?Math.min(6,Number(raw[1])+1):0);const content=runs(p,tab,!!level);
  if(level){const Heading=`h${level}` as 'h2'|'h3'|'h4'|'h5'|'h6';return <Heading id={headingId(b.startIndex||0,tab.tabId)} className="original-heading">{content}</Heading>;}
  if(p.elements?.some(e=>e.horizontalRule))return <div className="original-rule">{content}</div>;
  const hasImage=p.elements?.some(e=>e.inlineObjectElement);
  const textRuns=p.elements?.filter(e=>e.textRun?.content.trim())||[];const codeLine=!p.bullet&&textRuns.length>0&&textRuns.every(e=>!e.textRun?.textStyle?.bold&&/mono|courier|consolas/i.test(e.textRun?.textStyle?.weightedFontFamily?.fontFamily||''));
  return <p className={isEmptyNativeParagraph(b)?'original-empty':hasImage?'original-image-paragraph':codeLine?'original-code-line':undefined}>{content}</p>;
}
function blocks(content:NativeBlock[],tab:NativeTab,codeSections=false,presentation?:Presentation):ReactNode[]{const result:ReactNode[]=[];for(let i=0;i<content.length;i++){
  const b=content[i];
  if(presentation?.hidden.has(b)){result.push(<div key={`duplicate-${b.startIndex}`}><span id={headingId(b.startIndex||0,tab.tabId)} className="original-anchor" aria-hidden="true"/><div hidden className="original-duplicate" data-original-duplicate={b.startIndex}>{paragraph(b,tab,undefined,true)}</div></div>);continue;}
  const code=codeSections?nativeCodeGroup(content,i):null;
  if(code){result.push(<div className="original-code-section" key={`code-${b.startIndex}`} data-native-code-start={b.startIndex} data-native-code-end={content[code.end-1].startIndex}><CodeBlock code={code.code} language="Java"/></div>);i=code.end-1;continue;}
  if(b.paragraph?.bullet){const id=b.paragraph.bullet.listId;const items:NativeBlock[]=[];while(i<content.length&&content[i].paragraph?.bullet?.listId===id)items.push(content[i++]);i--;
    const list=tab.lists?.[id||'']?.listProperties?.nestingLevels;
    const container=(depth:number,nodes:ReactNode[],key?:string)=>{const spec=list?.[depth];const glyph=spec?.glyphType;const ordered=!!glyph&&glyph!=='GLYPH_TYPE_UNSPECIFIED';const types:Record<string,CSSProperties['listStyleType']>={DECIMAL:'decimal',ZERO_DECIMAL:'decimal-leading-zero',ALPHA:'lower-alpha',UPPER_ALPHA:'upper-alpha',ROMAN:'lower-roman',UPPER_ROMAN:'upper-roman'};return ordered?<ol key={key} start={spec?.startNumber||1} style={{listStyleType:types[glyph!]||'decimal'}}>{nodes}</ol>:<ul key={key}>{nodes}</ul>;};
    const renderLevel=(start:number,depth:number):{nodes:ReactNode[];next:number}=>{const nodes:ReactNode[]=[];let cursor=start;while(cursor<items.length){const item=items[cursor];const level=item.paragraph?.bullet?.nestingLevel||0;if(level<depth)break;if(level>depth){const nested=renderLevel(cursor,level);nodes.push(<li key={`nested-${cursor}`} className="original-list-continuation">{container(level,nested.nodes)}</li>);cursor=nested.next;continue;}const own=paragraph(item,tab);cursor++;let child:ReactNode=null;if(cursor<items.length&&(items[cursor].paragraph?.bullet?.nestingLevel||0)>depth){const nested=renderLevel(cursor,items[cursor].paragraph?.bullet?.nestingLevel||0);child=container(items[cursor].paragraph?.bullet?.nestingLevel||0,nested.nodes);cursor=nested.next;}nodes.push(<li key={item.startIndex||cursor} hidden={!child&&isEmptyNativeParagraph(item)}>{own}{child}</li>);}return {nodes,next:cursor};};
    const depth=Math.min(...items.map(item=>item.paragraph?.bullet?.nestingLevel||0));const children=renderLevel(0,depth).nodes;result.push(container(depth,children,`list-${b.startIndex}`));continue;}
  if(b.paragraph)result.push(<div className="original-block" key={`p-${b.startIndex}`}>{paragraph(b,tab,presentation?.headings.get(b))}</div>);
  else if(b.table)result.push(<div key={`table-${b.startIndex}`} className="original-table-scroll"><table className="original-table"><tbody>{b.table.tableRows.map((row,r)=><tr key={r}>{row.tableCells.map((cell,c)=>{const status=tab.tabId===HLD_ROADMAP_TAB_ID?roadmapStatusCell(b.table,r,c):null;const source=blocks(cell.content||[],tab);return <td key={c} rowSpan={cell.tableCellStyle?.rowSpan||1} colSpan={cell.tableCellStyle?.columnSpan||1} style={{backgroundColor:color(cell.tableCellStyle?.backgroundColor)}}>{status?<><div hidden>{source}</div><RoadmapStatus problemKey={status.key} title={status.title} initialStatus={status.status}/></>:source}</td>;})}</tr>)}</tbody></table></div>);
}return result;}
export function OriginalDocument({tab,codeSections=false,presentation=nativePresentation(tab)}:{tab:NativeTab;codeSections?:boolean;presentation?:Presentation}){return <div className="original-document" data-original-tab={tab.tabId}>{blocks(tab.body?.content||[],tab,codeSections,presentation)}</div>;}
