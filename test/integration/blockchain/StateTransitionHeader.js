const util = require('util');
const cbor = require('cbor');
const multihashingAsync = require('multihashing-async');
const multihashes = require('multihashes');
const StateTransitionHeader = require('../../../lib/blockchain/StateTransitionHeader');
const addSTPacketFactory = require('../../../lib/storage/addSTPacketFactory');
const startIPFSInstance = require('../../../lib/test/services/IPFS/startIPFSInstance');
const getStateTransitionPackets = require('../../../lib/test/fixtures/getRawStateTransitionPackets');
const getStateTransitionHeaders = require('../../../lib/test/fixtures/getRawStateTransitionHeaders');

const multihashing = util.promisify(multihashingAsync);

async function hashDataMerkleRoot(packet) {
  const serializedPacket = cbor.encodeCanonical(packet);
  const multihash = await multihashing(serializedPacket, 'sha2-256');
  const decoded = multihashes.decode(multihash);
  return decoded.digest.toString('hex');
}

describe('StateTransitionHeader', () => {
  const packets = getStateTransitionPackets();
  const packet = packets[0];

  const headers = getStateTransitionHeaders();
  const header = headers[0];

  let addSTPacket;

  before(async function before() {
    this.timeout(25000);
    const ipfsApi = await startIPFSInstance();
    addSTPacket = addSTPacketFactory(ipfsApi);
  });

  it('should StateTransitionHeader CID equal to IPFS CID', async () => {
    header.hashDataMerkleRoot = await hashDataMerkleRoot(packet);
    const stHeader = new StateTransitionHeader(header);

    const stHeaderCid = stHeader.getPacketCID();
    const ipfsCid = await addSTPacket(packet);

    expect(stHeaderCid).to.equal(ipfsCid);
  });
});
