import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export function Markdown({content}:{content:string}){
  let count=0;
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    h1:({children})=><h2 id={`section-${++count}`}>{children}</h2>,
    h2:({children})=><h2 id={`section-${++count}`}>{children}</h2>,
    h3:({children})=><h3 id={`section-${++count}`}>{children}</h3>,
    h4:({children})=><h4 id={`section-${++count}`}>{children}</h4>,
    a:({children,href})=><a href={href} target="_blank" rel="noreferrer">{children}</a>,
    img:({src,alt})=><img src={src} alt={alt||'Source note diagram'} loading="lazy" decoding="async"/>,
  }}>{content}</ReactMarkdown>;
}
