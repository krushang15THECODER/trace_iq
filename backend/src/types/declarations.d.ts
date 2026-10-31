declare module 'pdf-parse' {
  function PDFParse(dataBuffer: Buffer, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: any;
    text: string;
  }>;
  export default PDFParse;
}
