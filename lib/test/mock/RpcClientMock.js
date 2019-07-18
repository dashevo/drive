const getBlockFixtures = require('../fixtures/getBlocksFixture');
const getStateTransitionsFixture = require('../fixtures/getStateTransitionsFixture');

module.exports = class RpcClientMock {
  /**
   * @param {Object} sinonSandbox
   */
  constructor(sinonSandbox) {
    this.blocks = getBlockFixtures();
    this.transactions = getStateTransitionsFixture();

    const { __proto__: proto } = this;
    for (const method of Object.getOwnPropertyNames(proto)) {
      if (method === 'constructor') {
        continue;
      }

      if (proto[method].restore) {
        proto[method].restore();
      }

      sinonSandbox.stub(proto, method).callThrough();
    }
  }

  getBlockchainInfo() {
    const lastBlock = this.blocks[this.blocks.length - 1];
    return Promise.resolve({
      result: {
        blocks: lastBlock ? lastBlock.height : null,
        headers: lastBlock ? lastBlock.height : null,
        bestblockhash: lastBlock ? lastBlock.hash : null,
      },
    });
  }

  /**
   *
   */
  getBlockCount() {
    const lastBlock = this.blocks[this.blocks.length - 1];

    return Promise.resolve({ result: lastBlock ? lastBlock.height : 0 });
  }

  getBestBlockHash() {
    const lastBlock = this.blocks[this.blocks.length - 1];

    return Promise.resolve({ result: lastBlock ? lastBlock.hash : null });
  }

  /**
   * @param {number} height
   */
  getBlockHash(height) {
    const block = this.blocks.find(b => b.height === height);

    if (!block) {
      const error = new Error('Block height out of range');
      error.code = -8;
      throw error;
    }

    return Promise.resolve({ result: block ? block.hash : null });
  }

  /**
   * @param {string} hash
   */
  getBlock(hash) {
    const block = this.blocks.find(b => b.hash === hash);

    return Promise.resolve({ result: block });
  }

  /**
   * @param {string} hash
   */
  getTransaction(hash) {
    const transaction = this.transactions.find(h => h.hash === hash);

    if (!transaction) {
      return Promise.reject(new Error(`Transaction ${hash} not found`));
    }

    return Promise.resolve({ result: transaction });
  }

  /**
   * Get raw transaction
   *
   * @param {string} hash
   * @param {number} [parsed]
   * @return {Promise<{ result }>}
   */
  async getRawTransaction(hash, parsed = 0) {
    const { result: transaction } = await this.getTransaction(hash);

    if (parsed) {
      return { result: transaction };
    }

    return { result: transaction.serialize() };
  }

  mnsync(mode) {
    if (mode !== 'status') {
      throw new Error('Not implemented yet!');
    }
    return Promise.resolve({ result: { IsBlockchainSynced: true } });
  }
};