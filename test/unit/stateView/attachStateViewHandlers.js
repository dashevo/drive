const Emitter = require('emittery');
const getTransitionHeaderFixtures = require('../../../lib/test/fixtures/getTransitionHeaderFixtures');
const attachStateViewHandlers = require('../../../lib/stateView/attachStateViewHandlers');
const STHeadersReader = require('../../../lib/blockchain/reader/STHeadersReader');

describe('attachStateViewHandlers', () => {
  let stHeadersReaderMock;
  let applyStateTransition;
  let revertDapContractsForBlock;
  let dropMongoDatabasesWithPrefixStub;

  beforeEach(function beforeEach() {
    class STHeadersReaderMock extends Emitter {}
    stHeadersReaderMock = new STHeadersReaderMock();
    applyStateTransition = this.sinon.stub();
    revertDapContractsForBlock = this.sinon.stub();
    dropMongoDatabasesWithPrefixStub = this.sinon.stub();
    attachStateViewHandlers(
      stHeadersReaderMock,
      applyStateTransition,
      revertDapContractsForBlock,
      dropMongoDatabasesWithPrefixStub,
    );
  });

  it('should call attachStateViewHandlers on new block header', async () => {
    const header = getTransitionHeaderFixtures()[0];
    await stHeadersReaderMock.emitSerial(STHeadersReader.EVENTS.HEADER, { header });
    expect(applyStateTransition).to.be.calledOnce();
  });

  it('should call revertDapContractsForBlock on a stale block', async () => {
    const staleBlock = {};
    await stHeadersReaderMock.emitSerial(STHeadersReader.EVENTS.STALE_BLOCK, { staleBlock });
    expect(revertDapContractsForBlock).to.be.calledOnce();
  });

  it('should call dropMongoDatabasesWithPrefix on reset event', async () => {
    await stHeadersReaderMock.emit(STHeadersReader.EVENTS.RESET);
    expect(dropMongoDatabasesWithPrefixStub).to.be.calledOnce();
  });
});
