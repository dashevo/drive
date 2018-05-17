const startIPFSInstance = require('../../../../../lib/test/services/IPFS/startIPFSInstance');

describe('startIPFSInstance', function main() {
  this.timeout(40000);

  describe('One instance', () => {
    let ipfsAPI;
    before(async () => {
      ipfsAPI = await startIPFSInstance();
    });
    after(async () => ipfsAPI.remove());

    it('should start one instance', async () => {
      const actualTrueObject = await ipfsAPI.block.put(Buffer.from('{"true": true}'));
      const expectedTrueObject = await ipfsAPI.block.get(actualTrueObject.cid);
      expect(expectedTrueObject.data).to.be.deep.equal(actualTrueObject.data);
    });
  });

  describe('Three instances', () => {
    let ipfsAPIs;
    before(async () => {
      ipfsAPIs = await startIPFSInstance.many(3);
    });
    after(async () => {
      const promises = ipfsAPIs.map(instance => instance.remove());
      await Promise.all(promises);
    });

    it('should start many instances', async () => {
      const actualTrueObject = await ipfsAPIs[0].block.put(Buffer.from('{"true": true}'));

      for (let i = 1; i < 3; i++) {
        const expectedTrueObject = await ipfsAPIs[i].block.get(actualTrueObject.cid);
        expect(expectedTrueObject.data).to.be.deep.equal(actualTrueObject.data);
      }
    });
  });
});
