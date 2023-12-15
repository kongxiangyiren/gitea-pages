declare module 'thinkjs' {
  interface ThinkRedisCtx {
    session(name: string): Promise<string>;

    session(name: string, value: string | object): Promise<string>;

    session(name: null): Promise<string>;

    session(
      name: string,
      value: string | object,
      options: object
    ): Promise<string>;
  }
}

declare module 'dns-sync';
