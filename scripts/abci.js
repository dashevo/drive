require('dotenv-expand')(require('dotenv-safe').config());

const createServer = require('abci');
const { onShutdown } = require('node-graceful-shutdown');

const createDIContainer = require('../lib/createDIContainer');

const errorHandlerFactory = require('../lib/errorHandlerFactory');

(async function main() {
  const container = await createDIContainer(process.env);

  const errorHandler = errorHandlerFactory(container);

  process
    .on('unhandledRejection', errorHandler)
    .on('uncaughtException', errorHandler);

  onShutdown('abci', async () => {
    await container.dispose();
  });

  const logger = container.resolve('logger');

  logger.info('Connecting to MongoDB');
  const waitReplicaSetInitialize = container.resolve('waitReplicaSetInitialize');
  await waitReplicaSetInitialize((retry, maxRetries) => {
    logger.info(
      `waiting for replica set to be initialized ${retry}/${maxRetries}...`,
    );
  });

  logger.info('Connecting to Core');
  const detectStandaloneRegtestMode = container.resolve('detectStandaloneRegtestMode');

  const isStandaloneRegtestMode = await detectStandaloneRegtestMode();

  if (!isStandaloneRegtestMode) {
    const waitForCoreSync = container.resolve('waitForCoreSync');
    await waitForCoreSync((currentBlockHeight, currentHeaderNumber) => {
      logger.info(
        `waiting for Core to finish sync ${currentBlockHeight}/${currentHeaderNumber}...`,
      );
    });

    logger.info('Obtaining the latest Core ChainLock...');
    const waitForCoreChainLockSync = container.resolve('waitForCoreChainLockSync');
    await waitForCoreChainLockSync();
  } else {
    logger.info('Obtaining the latest core block for chain lock sync fallback...');
    const waitForCoreChainLockSyncFallback = container.resolve('waitForCoreChainLockSyncFallback');
    await waitForCoreChainLockSyncFallback();
  }

  const waitForDmlActivated = container.resolve('waitForDmlActivated');

  logger.info('Checking DML is activated...');

  await waitForDmlActivated();

  const server = createServer(
    container.resolve('abciHandlers'),
  );

  server.listen(
    container.resolve('abciPort'),
    container.resolve('abciHost'),
  );

  logger.info(`Drive ABCI is listening on port ${container.resolve('abciPort')}`);
}());
