const fs = require('fs');
const path = require('path');

const { expect, use } = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

use(sinonChai);

const BlockIterator = require('../../lib/blockchain/BlockIterator');
const WrongBlocksSequenceError = require('../../lib/blockchain/WrongBlocksSequenceError');

describe('BlockIterator', () => {
  let blocks;
  let rpcClientMock;
  let getBlockHashSpy;
  let getBlockSpy;

  beforeEach(function beforeEach() {
    if (!this.sinon) {
      this.sinon = sinon.sandbox.create();
    } else {
      this.sinon.restore();
    }

    const blocksJSON = fs.readFileSync(path.join(__dirname, '/../fixtures/blocks.json'));
    blocks = JSON.parse(blocksJSON);

    rpcClientMock = {
      getBlockReturnValue: null,

      getBlockHash(height, callback) {
        const block = blocks.find(b => b.height === height);
        callback(null, { result: block ? block.hash : null });
      },
      getBlock(hash, callback) {
        let block = this.getBlockReturnValue;
        if (!block) {
          block = blocks.find(b => b.hash === hash);
        }

        callback(null, { result: block });
      },
      setGetBlockReturnValue(value) {
        this.getBlockReturnValue = value;
      },
    };

    getBlockHashSpy = this.sinon.spy(rpcClientMock, 'getBlockHash');
    getBlockSpy = this.sinon.spy(rpcClientMock, 'getBlock');
  });

  it('should iterate over blocks from blockchain', async () => {
    const fromBlockHeight = 1;
    const obtainedBlocks = [];

    const blockIterator = new BlockIterator(rpcClientMock, fromBlockHeight);

    let done;
    let block;

    // eslint-disable-next-line no-cond-assign
    while ({ done, value: block } = await blockIterator.next()) {
      if (done) {
        break;
      }

      obtainedBlocks.push(block);
    }

    expect(getBlockHashSpy).to.be.calledOnce.and.calledWith(fromBlockHeight);
    expect(getBlockSpy).has.callCount(blocks.length);
    expect(obtainedBlocks).to.be.deep.equal(blocks);
  });

  it('should should throws error if blocks sequence is wrong (e.g. reorg)', async () => {
    const fromBlockHeight = 1;

    const blockIterator = new BlockIterator(rpcClientMock, fromBlockHeight);

    await blockIterator.next();

    rpcClientMock.setGetBlockReturnValue(blocks[2]);

    try {
      await blockIterator.next();
    } catch (e) {
      if (e instanceof WrongBlocksSequenceError) {
        return;
      }
    }

    throw new Error('should throws WrongBlocksSequenceError');
  });
});
