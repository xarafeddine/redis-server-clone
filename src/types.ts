export type KeyValueStore = {
  [key: string]: {
    value: string;
    expiration?: Date;
  };
};

export type StreamEntries = Record<string, Record<string, string>>;

export type StoreValue = {
  value: string;
  expiration?: Date;
};

export type ServerConfig = {
  dir: string;
  dbfilename: string;
};
