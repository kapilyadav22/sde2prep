import { redirect } from 'next/navigation';
export const metadata={title:'Notes',robots:{index:false,follow:true}};
export default function Page(){redirect('/library/');}
