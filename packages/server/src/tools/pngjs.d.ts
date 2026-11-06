// The bits of pngjs (a root devDependency, no types of its own) the nav pictures use.
declare module 'pngjs' {
  export class PNG {
    constructor(opts: { width: number; height: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: { write(png: PNG): Buffer };
  }
}
