import { handwrittenNotes } from '@/lib/handwritten';
import { HandwrittenLibrary } from '@/components/handwritten-library';
export const metadata={title:'Handwritten notes',description:'Read handwritten interview preparation notebooks in the built-in PDF reader.',alternates:{canonical:'/handwritten/'}};
export default function Page(){return <HandwrittenLibrary notes={handwrittenNotes}/>;}
