export type LiveFile={id:string;title:string;name:string;kind:'pdf'|'docx'|'doc'|'markdown'|'text'|'gdoc';topic:string};
export type FolderResponse={files:LiveFile[];checkedAt:string;refreshAfter:number};
export async function readFolder(refresh=false,signal?:AbortSignal):Promise<FolderResponse>{
  const response=await fetch(`/api/handwritten${refresh?'?refresh=1':''}`,{cache:'no-store',signal});
  const data=await response.json();
  if(!response.ok||!Array.isArray(data.files))throw new Error(data.error||'Unable to read the notes folder.');
  return data;
}
export const liveFileHref=(file:LiveFile)=>`/handwritten/read/?id=${encodeURIComponent(file.id)}`;
