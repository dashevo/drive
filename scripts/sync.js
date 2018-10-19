require('dotenv-expand')(require('dotenv-safe').config());

const zmq = require('zeromq');

const SyncAppOptions = require('../lib/app/SyncAppOptions');
const SyncApp = require('../lib/app/SyncApp');
const attachStorageHandlers = require('../lib/storage/attachStorageHandlers');
const attachSyncHandlers = require('../lib/sync/state/attachSyncHandlers');
const attachStateViewHandlers = require('../lib/stateView/attachStateViewHandlers');
const readChainFactory = require('../lib/blockchain/readChainFactory');
const errorHandler = require('../lib/util/errorHandler');

(async function main() {
  const syncAppOptions = new SyncAppOptions(process.env);
  const syncApp = new SyncApp(syncAppOptions);
  await syncApp.init();

  const stHeaderReader = syncApp.createSTHeadersReader();
  const rpcClient = syncApp.getRpcClient();
  const ipfsAPI = syncApp.getIpfsApi();
  const unpinAllIpfsPackets = syncApp.createUnpinAllIpfsPackets();
  const syncState = syncApp.getSyncState();
  const syncStateRepository = syncApp.getSyncStateRepository();
  const applyStateTransition = syncApp.createApplyStateTransition();
  const revertDapContractsForBlock = syncApp.createRevertDapContractsForBlock(applyStateTransition);
  const dropMongoDatabasesWithPrefix = syncApp.createDropMongoDatabasesWithPrefix();
  const cleanDashDrive = syncApp.createCleanDashDrive();

  // Attach listeners to ST Header Reader
  attachStorageHandlers(
    stHeaderReader,
    ipfsAPI,
    unpinAllIpfsPackets,
    syncAppOptions.getStorageIpfsTimeout(),
  );

  attachSyncHandlers(
    stHeaderReader,
    syncState,
    syncStateRepository,
  );

  attachStateViewHandlers(
    stHeaderReader,
    applyStateTransition,
    revertDapContractsForBlock,
    dropMongoDatabasesWithPrefix,
  );

  const readChain = readChainFactory(stHeaderReader, rpcClient, syncState, cleanDashDrive);

  // Sync arriving ST packets
  const zmqSocket = zmq.createSocket('sub');
  zmqSocket.connect(syncAppOptions.getDashCoreZmqPubHashBlock());

  zmqSocket.on('message', (topic, blockHash) => {
    const sinceBlockHash = blockHash.toString('hex');
    readChain(sinceBlockHash).catch(errorHandler);
  });

  zmqSocket.subscribe('hashblock');

  await readChain();
}()).catch(errorHandler);
