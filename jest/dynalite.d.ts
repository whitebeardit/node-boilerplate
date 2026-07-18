declare module 'dynalite' {
  import { Server } from 'http';

  interface IDynaliteOptions {
    createTableMs?: number;
    deleteTableMs?: number;
    updateTableMs?: number;
    path?: string;
    ssl?: boolean;
  }

  function dynalite(options?: IDynaliteOptions): Server;

  export = dynalite;
}
