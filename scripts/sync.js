require('dotenv').config();

const zmq = require('zeromq');
const IpfsAPI = require('ipfs-api');
const RpcClient = require('bitcoind-rpc-dash/promise');
const { MongoClient } = require('mongodb');

const SyncStateRepository = require('../lib/sync/state/repository/SyncStateRepository');
const RpcBlockIterator = require('../lib/blockchain/iterator/RpcBlockIterator');
const StateTransitionHeaderIterator = require('../lib/blockchain/iterator/StateTransitionHeaderIterator');
const STHeadersReaderState = require('../lib/blockchain/reader/STHeadersReaderState');
const STHeadersReader = require('../lib/blockchain/reader/STHeadersReader');
const DapContractMongoDbRepository = require('../lib/stateView/dapContract/DapContractMongoDbRepository');
const storeDapContractFactory = require('../lib/stateView/dapContract/storeDapContractFactory');

const attachPinSTPacketHandler = require('../lib/storage/attachPinSTPacketHandler');
const attachStoreSyncStateHandler = require('../lib/sync/state/attachStoreSyncStateHandler');
const attachStoreDapContractHandler = require('../lib/stateView/dapContract/attachStoreDapContractHandler');
const errorHandler = require('../lib/util/errorHandler');

(async function main() {
  const rpcClient = new RpcClient({
    protocol: 'http',
    host: process.env.DASHCORE_JSON_RPC_HOST,
    port: process.env.DASHCORE_JSON_RPC_PORT,
    user: process.env.DASHCORE_JSON_RPC_USER,
    pass: process.env.DASHCORE_JSON_RPC_PASS,
  });

  const blockIterator = new RpcBlockIterator(
    rpcClient,
    parseInt(process.env.SYNC_EVO_START_BLOCK_HEIGHT, 10),
  );

  const stHeaderIterator = new StateTransitionHeaderIterator(blockIterator, rpcClient);

  const mongoClient = await MongoClient.connect(process.env.STORAGE_MONGODB_URL);
  const mongoDb = mongoClient.db(process.env.STORAGE_MONGODB_DB);
  const syncStateRepository = new SyncStateRepository(mongoDb);
  const syncState = await syncStateRepository.fetch();

  // TODO: Parse variable to int if present
  const stHeadersReaderState = new STHeadersReaderState(
    syncState.getBlocks(),
    process.env.SYNC_STATE_BLOCKS_LIMIT,
  );

  const stHeaderReader = new STHeadersReader(stHeaderIterator, stHeadersReaderState);

  const ipfsAPI = new IpfsAPI(process.env.STORAGE_IPFS_MULTIADDR);

  attachPinSTPacketHandler(stHeaderReader, ipfsAPI);
  attachStoreSyncStateHandler(stHeaderReader, syncState, syncStateRepository);
  const dapContractMongoDbRepository = new DapContractMongoDbRepository(mongoDb);
  const storeDapContract = storeDapContractFactory(dapContractMongoDbRepository, ipfsAPI);
  attachStoreDapContractHandler(stHeaderReader, storeDapContract);

  let isFirstSyncCompleted = false;
  try {
    await stHeaderReader.read();

    isFirstSyncCompleted = true;
  } catch (error) {
    if (error.message !== 'Block height out of range') {
      throw error;
    }
  }

  // Sync arriving ST packets
  const zmqSocket = zmq.createSocket('sub');
  zmqSocket.connect(process.env.DASHCORE_ZMQ_PUB_HASHBLOCK);

  let isInSync = false;

  async function onBlockHash(blockHash) {
    if (isInSync) {
      return;
    }

    isInSync = true;

    // Start sync from the last synced block + 1
    let height = blockIterator.getBlockHeight();
    if (isFirstSyncCompleted) {
      height += 1;
    }

    // Reset height to the current block's height
    const { result: { height: blockHeight } } = rpcClient.getBlock(blockHash);
    if (blockHeight < height) {
      height = blockHeight;
    }

    blockIterator.setBlockHeight(height);
    stHeaderIterator.reset(false);

    await stHeaderReader.read();

    isFirstSyncCompleted = true;

    isInSync = false;
  }

  zmqSocket.on('message', (topic, blockHash) => {
    onBlockHash(blockHash).catch((error) => {
      isInSync = false;
      errorHandler(error);
    });
  });

  zmqSocket.subscribe('hashblock');
}()).catch(errorHandler);
