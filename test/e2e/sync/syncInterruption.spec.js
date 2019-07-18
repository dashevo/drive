const { startDrive } = require('@dashevo/dp-services-ctl');

const getSTPacketsFixture = require('../../../lib/test/fixtures/getSTPacketsFixture');

const ApiAppOptions = require('../../../lib/app/ApiAppOptions');

const registerUser = require('../../../lib/test/registerUser');

const createStateTransition = require('../../../lib/test/createStateTransition');
const wait = require('../../../lib/util/wait');

const apiAppOptions = new ApiAppOptions(process.env);

/**
 * Await Dash Drive instance to finish syncing
 *
 * @param {DriveApi} instance
 * @returns {Promise<void>}
 */
async function driveSyncToFinish(instance) {
  let finished = false;
  while (!finished) {
    try {
      const { result: syncInfo } = await instance.getApi()
        .request('getSyncInfo', []);

      if (syncInfo.status === 'synced') {
        finished = true;
        await wait(apiAppOptions.getSyncStateCheckInterval());
      } else {
        await wait(1000);
      }
    } catch (e) {
      await wait(1000);
    }
  }
}

describe('Sync interruption and resume between Dash Drive and Dash Core', function describe() {
  let firstDrive;
  let secondDrive;

  this.timeout(900000);

  before('having Dash Drive node #1 up and running', async () => {
    // 1. Start first Dash Drive node
    firstDrive = await startDrive();

    // 1.1 Activate Special Transactions
    await firstDrive.dashCore.getApi().generate(1000);

    const [stPacket] = getSTPacketsFixture();

    // 2. Populate Dash Drive and Dash Core with data
    async function createAndSubmitST(username) {
      // 2.1 Set ST Packet name
      stPacket.getContract().setName(`${username}_contract`);
      stPacket.setContractId(stPacket.getContract().getId());

      // 2.2 Register user and create Contract ST Packet and State Transition
      const {
        userId,
        privateKeyString,
      } = await registerUser(username, firstDrive.dashCore.getApi());

      const stateTransition = await createStateTransition(userId, privateKeyString, stPacket);

      // 2.3 Add ST packet
      const driveApi = firstDrive.driveApi.getApi();
      const { error } = await driveApi.request('addSTPacket', {
        stPacket: stPacket.serialize().toString('hex'),
        stateTransition: stateTransition.serialize(),
      });

      if (error) {
        throw new Error(`Can't add ST Packet: ${JSON.stringify(error)}`);
      }

      // 2.4 Send ST to Dash Core and generate a block with it
      await firstDrive.dashCore.getApi().sendRawTransaction(stateTransition.serialize());
      await firstDrive.dashCore.getApi().generate(1);
    }

    // Note: I can't use Promise.all here due to errors with PrivateKey
    //       I guess some of the actions can't be executed in parallel
    for (let i = 0; i < 20; i++) {
      await createAndSubmitST(`Alice_${i}`);
    }
  });

  it('Dash Drive should save sync state and continue from saved point after resume', async () => {
    // 3. Start 2nd Dash Drive node and connect to the first one
    secondDrive = await startDrive();

    await secondDrive.ipfs.connect(firstDrive.ipfs);
    await secondDrive.dashCore.connect(firstDrive.dashCore);

    // 4. Save initial list of CIDs in IPFS before Dash Drive started on 2nd node
    let lsResult = await secondDrive.ipfs.getApi().pin.ls();
    const initialHashes = lsResult.map(item => item.hash);

    // 5. Wait for IPFS on 2nd node to have 3 packets pinned
    //    Wait maximum of 60 seconds in total

    // TODO: implement this bit in the future using
    //       getSyncStatus API method of Dash Drive
    //       possibly implemented in DD-196
    for (let i = 0; i < 60; i++) {
      lsResult = await secondDrive.ipfs.getApi().pin.ls();
      const pinnedHashes = lsResult
        .filter(item => initialHashes.indexOf(item.hash) === -1)
        .map(item => item.hash);
      if (pinnedHashes.length >= 3) {
        break;
      }
      await wait(1000);
    }

    // 6. Stop Dash Drive on 2nd node
    await secondDrive.driveSync.stop();

    // 7. Save a list of CIDs pinned on 2nd node
    //    Filter out initial CIDs from step #4
    //    to have a clean list of freshly pinned CIDs
    //    as a result of sync process
    lsResult = await secondDrive.ipfs.getApi().pin.ls();
    const pinnedHashes = lsResult
      .filter(item => initialHashes.indexOf(item.hash) === -1)
      .map(item => item.hash);

    // 8. Remove freshly pinned CIDs
    //    This will allow us to check
    //    sync started from the point it stopped
    const rmPromises = Promise
      .all(pinnedHashes.map(hash => secondDrive.ipfs.getApi().pin.rm(hash)));
    await rmPromises;

    // 9. Start Dash Drive on 2nd node
    await secondDrive.driveSync.start();

    // 10. Await Dash Drive to finish the rest of synchronisation
    await driveSyncToFinish(secondDrive.driveApi);

    // 11. Check that CIDs pinned after sync does not contain
    //     CIDs removed in step #8
    lsResult = await secondDrive.ipfs.getApi().pin.ls();

    const hashesAfterResume = lsResult.map(item => item.hash);

    expect(hashesAfterResume).to.not.contain.members(pinnedHashes);

    // TODO Check that all contracts are available
  });

  after('cleanup services', async () => {
    const instances = [
      firstDrive,
      secondDrive,
    ];

    await Promise.all(instances.filter(i => i)
      .map(i => i.remove()));
  });
});