export type keyValueStore = {
  [key: string]: {
    value: string;
    expiration?: Date;
  };
};

export type serverConfig = {
  dir: string;
  dbfilename: string;
};
