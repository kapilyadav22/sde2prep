import type { Metadata } from 'next';
import { Workspace } from '@/components/workspace';
import { library, origin } from '@/lib/content';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: { default: 'sde2prep — A little more prepared, every day.', template: '%s | sde2prep' },
  description: 'A personal SDE 2 interview preparation library. Explore DSA, LLD, HLD, AWS, Redis, Java multithreading, Spring Boot, Kafka, JUnit and Mockito notes.',
  applicationName: 'sde2prep', authors: [{name:'Kapil Yadav'}], icons:{icon:'/icon.svg'},
  openGraph: {type:'website',locale:'en_US',siteName:'sde2prep',title:'sde2prep — Your interview workspace',description:'Your knowledge, connected. Engineering interview notes, original diagrams, structured code, and focused practice in one workspace.',images:[{url:'/opengraph.png',width:1200,height:630}]},
  twitter: {card:'summary_large_image'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><Workspace initialNotes={library.notes.map(({content,...n})=>({...n,content:''}))} initialSources={library.sources} problems={library.problems}>{children}</Workspace></body></html>;
}
