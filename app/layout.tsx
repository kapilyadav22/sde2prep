import type { Metadata } from 'next';
import { Workspace } from '@/components/workspace';
import { library, origin } from '@/lib/content';
import './globals.css';
import '@/components/article-typography.css';
import './workspace-theme.css';
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: { default: 'sde2prep — Interview preparation', template: '%s | sde2prep' },
  description: 'A personal SDE 2 interview preparation library. Explore DSA, LLD, HLD, AWS, Redis, Java multithreading, Spring Boot, Kafka, JUnit and Mockito notes.',
  applicationName: 'sde2prep', authors: [{name:'Kapil Yadav'}], icons:{icon:'/icon.svg'},
  openGraph: {type:'website',locale:'en_US',siteName:'sde2prep',title:'sde2prep — Your interview workspace',description:'Your knowledge, connected. Engineering interview notes, original diagrams, structured code, and focused practice in one workspace.',images:[{url:'/opengraph.png',width:1200,height:630}]},
  twitter: {card:'summary_large_image'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('sde2prep-theme');document.documentElement.dataset.theme=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`}}/></head><body><Workspace initialNotes={library.notes.map(n=>({id:n.id,title:n.title,category:n.category,sourceId:n.sourceId,description:n.description,minutes:n.minutes,updatedAt:n.updatedAt,tags:n.tags,content:''}))} initialSources={library.sources} problems={library.problems}>{children}</Workspace></body></html>;
}
