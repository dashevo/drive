const { expect, use } = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const dirtyChai = require('dirty-chai');
const chaiAsPromised = require('chai-as-promised');

use(dirtyChai);
use(sinonChai);
use(chaiAsPromised);

const EventEmitter = require('events');

const isSynced = require('../../lib/sync/isSynced');
const SyncState = require('../../lib/sync/state/SyncState');
const RpcClientMock = require('../../lib/test/mock/RpcClientMock');

describe('isSynced', () => {
  let rpcClientMock;
  let syncStateRepositoryMock;
  let changeListenerMock;

  beforeEach(function beforeEach() {
    if (!this.sinon) {
      this.sinon = sinon.sandbox.create();
    } else {
      this.sinon.restore();
    }

    syncStateRepositoryMock = {
      fetch: this.sinon.stub(),
    };

    class SyncStateRepositoryChangeListener extends EventEmitter {
      // eslint-disable-next-line class-methods-use-this
      getRepository() {
        return syncStateRepositoryMock;
      }

      // eslint-disable-next-line class-methods-use-this
      listen() { }

      // eslint-disable-next-line class-methods-use-this
      stop() { }
    }

    changeListenerMock = new SyncStateRepositoryChangeListener();
    this.sinon.spy(changeListenerMock, 'listen');
    this.sinon.spy(changeListenerMock, 'stop');
    this.sinon.spy(changeListenerMock, 'removeListener');

    rpcClientMock = new RpcClientMock(this.sinon);
  });

  it('should return state if IsBlockchainSynced and last block in chain is synced ', async () => {
    const state = new SyncState(rpcClientMock.blocks, new Date());
    syncStateRepositoryMock.fetch.returns(state);

    rpcClientMock.mnsync.onCall(0).returns(Promise.resolve({ IsBlockchainSynced: false }));
    rpcClientMock.mnsync.onCall(1).returns(Promise.resolve({ IsBlockchainSynced: true }));

    const syncedState = await isSynced(rpcClientMock, changeListenerMock);

    expect(state).to.be.equals(syncedState);
  }).timeout(10000);

  it('should return state if last block in chain is synced', async () => {
    const state = new SyncState(rpcClientMock.blocks, new Date());
    syncStateRepositoryMock.fetch.returns(state);

    const syncedState = await isSynced(rpcClientMock, changeListenerMock);

    expect(state).to.be.equals(syncedState);
  });

  it('should listen changes until last block in chain is synced', (done) => {
    const state = new SyncState([], new Date());
    syncStateRepositoryMock.fetch.returns(state);

    const isSyncedPromise = isSynced(rpcClientMock, changeListenerMock);

    setImmediate(() => {
      expect(changeListenerMock.listen).to.be.calledOnce();

      // State changed but sync is not completed
      state.setBlocks([rpcClientMock.blocks[0]]);
      changeListenerMock.emit('change', state);

      expect(changeListenerMock.stop).not.to.be.called();
      expect(changeListenerMock.removeListener).not.to.be.called();

      // State changed and sync is completed
      const changedState = new SyncState(rpcClientMock.blocks, new Date());
      changeListenerMock.emit('change', changedState);

      expect(changeListenerMock.removeListener).to.be.calledOnce();
      expect(changeListenerMock.removeListener).to.be.calledWith('change');

      expect(changeListenerMock.stop).to.be.calledOnce();

      expect(isSyncedPromise).become(changedState);

      done();
    });
  });

  it('should return error if change listener emits error', (done) => {
    const state = new SyncState([], new Date());
    syncStateRepositoryMock.fetch.returns(state);

    const isSyncedPromise = isSynced(rpcClientMock, changeListenerMock);

    setImmediate(() => {
      const error = new Error();
      changeListenerMock.emit('error', error);

      expect(isSyncedPromise).to.be.rejectedWith(error);

      done();
    });
  });
});
