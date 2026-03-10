import { Clarinet, Tx, Chain, types } from 'https://deno.land/x/clarinet@v1.2.0/index.ts';

const assertEquals = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`Expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`);
  }
};

type Account = {
  address: string;
  name: string;
};

export { Clarinet, Tx, Chain, types, assertEquals, Account };
