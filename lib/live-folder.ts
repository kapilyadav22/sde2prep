export type LiveFile={id:string;title:string;name:string;kind:'pdf'|'docx'|'doc'|'markdown'|'text'|'gdoc';topic:string};
export type FolderResponse={files:LiveFile[];checkedAt:string;refreshAfter?:number};
export async function readFolder(refresh=false,signal?:AbortSignal):Promise<FolderResponse>{
  const response=await fetch(`/api/handwritten${refresh?'?refresh=1':''}`,{cache:'no-store',signal});
  const text=await response.text();
  let data:Record<string,unknown>={};
  try{data=JSON.parse(text);}catch{throw new Error('The handwritten notes API is unavailable on this deployment. This feature requires a Cloudflare Worker backend.');}
  if(!response.ok||!Array.isArray(data.files))throw new Error((data.error as string)||'Unable to read the notes folder.');
  return data as unknown as FolderResponse;
}
export const liveFileHref=(file:LiveFile)=>`/handwritten/read/?id=${encodeURIComponent(file.id)}`;
