import net from "net";
export type KeyValueStore = {
  [key: string]: {
    value: string;
    expiration?: Date;
  };
};

export type EntryData = Record<string, string>;
// export type StreamEntry = {
//   entryId: string;
//   entryData: EntryData;
// };

export type StreamEntry = [string, string[]];

export type StoreValue = {
  value: string;
  expiration?: Date;
};

export type ServerConfig = {
  dir: string;
  dbfilename: string;
  port: number;
  host: string;
  role: string;
  replicaOfHost: string;
  replicaOfPort: number;
  master_replid: string;
  getAck: boolean;
  offset: number;
  replicas: replicaState[];
  ackCount: number;
};

type replicaState = {
  connection: net.Socket;
  offset: number;
  active: boolean;
};
