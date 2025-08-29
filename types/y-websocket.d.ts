declare module "y-websocket" {
  import { Doc } from "yjs";

  export class WebsocketProvider {
    constructor(serverUrl: string, roomName: string, doc: Doc, options?: any);
    awareness: any;
    destroy(): void;
  }
}
