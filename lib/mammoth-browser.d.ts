declare module 'mammoth/mammoth.browser' {
  export function convertToHtml(input:{arrayBuffer:ArrayBuffer}):Promise<{value:string;messages:{type:string;message:string}[]}>;
}
