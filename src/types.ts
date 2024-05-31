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
};
