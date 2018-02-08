/* eslint-disable no-console */

const jayson = require('jayson/promise');

const host = '127.0.0.1';
const port = 9998;
const username = 'dashrpc';
const password = 'password';

const realm = Buffer.from([username, password].join(':')).toString('base64');

const headers = {
  Authorization: `Basic ${realm}`,
};

const client = jayson.client.http({ host, port, headers });

async function main() {
  const response = await client.request('getblockcount', []);

  console.log('The current block count is: %d', response.result);
}

main().catch(e => console.error(e));
