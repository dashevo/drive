const {
  StartTransactionRequest,
  ApplyStateTransitionRequest,
  CommitTransactionRequest,
  StartTransactionResponse,
  ApplyStateTransitionResponse,
  CommitTransactionResponse,
} = require('@dashevo/drive-grpc');
const {
  startDrive,
} = require('@dashevo/dp-services-ctl');

const getStateTransitionsFixture = require('../../lib/test/fixtures/getStateTransitionsFixture');
const registerUser = require('../../lib/test/registerUser');

describe('updateState', function main() {
  let grpcClient;
  let driveApiClient;
  let stateTransition;
  let documentsStateTransition;
  let startTransactionRequest;
  let applyStateTransitionRequest;
  let commitTransactionRequest;
  let driveInstance;

  const height = 1;
  const hash = 'b4749f017444b051c44dfd2720e88f314ff94f3dd6d56d40ef65854fcd7fff6b';
  const nextHash = 'b4749f017444b051c44dfd2720e88f314ff94f3dd6d56d40ef65854fcd7fff7b';

  this.timeout(90000);

  beforeEach(async () => {
    driveInstance = await startDrive();

    grpcClient = driveInstance.driveUpdateState.getApi();
    driveApiClient = driveInstance.driveApi.getApi();
    const coreApi = driveInstance.dashCore.getApi();

    // activate sporks
    await coreApi.generate(1000);

    const { userId, privateKeyString: userPrivateKeyString } = await registerUser('testUser', coreApi);

    [stateTransition, documentsStateTransition] = getStateTransitionsFixture();

    startTransactionRequest = new StartTransactionRequest();
    startTransactionRequest.setBlockHeight(height);

    applyStateTransitionRequest = new ApplyStateTransitionRequest();
    applyStateTransitionRequest.setStateTransition(Buffer.from(stateTransition.serialize(), 'hex'));
    applyStateTransitionRequest.setBlockHeight(height);
    applyStateTransitionRequest.setBlockHash(hash);

    commitTransactionRequest = new CommitTransactionRequest();
    commitTransactionRequest.setBlockHeight(height);
  });

  after(async () => {
    await Promise.all([
      driveInstance.remove(),
    ]);
  });

  it('should successfully apply state transition and commit data', async () => {
    const startTransactionResponse = await grpcClient.startTransaction(startTransactionRequest);
    const applyStateTransitionResponse = await grpcClient
      .applyStateTransition(applyStateTransitionRequest);
    const commitTransactionResponse = await grpcClient.commitTransaction(commitTransactionRequest);

    expect(startTransactionResponse).to.be.an.instanceOf(StartTransactionResponse);
    expect(applyStateTransitionResponse).to.be.an.instanceOf(ApplyStateTransitionResponse);
    expect(commitTransactionResponse).to.be.an.instanceOf(CommitTransactionResponse);

    // check we have our data in database
    const { result: contract } = await driveApiClient.request('fetchContract', {
      contractId: stateTransition.getDataContract().getId(),
    });

    expect(contract).to.deep.equal(stateTransition.getDataContract().toJSON());

    startTransactionRequest = new StartTransactionRequest();
    startTransactionRequest.setBlockHeight(height + 1);

    applyStateTransitionRequest = new ApplyStateTransitionRequest();
    applyStateTransitionRequest.setStateTransition(
      Buffer.from(documentsStateTransition.serialize(), 'hex'),
    );
    applyStateTransitionRequest.setBlockHeight(height + 1);
    applyStateTransitionRequest.setBlockHash(nextHash);

    commitTransactionRequest = new CommitTransactionRequest();
    commitTransactionRequest.setBlockHeight(height + 1);

    await grpcClient.startTransaction(startTransactionRequest);
    await grpcClient.applyStateTransition(applyStateTransitionRequest);
    await grpcClient.commitTransaction(commitTransactionRequest);

    const { result: niceDocuments } = await driveApiClient.request('fetchDocuments', {
      contractId: stateTransition.getDataContract().getId(),
      type: 'niceDocument',
    });

    const { result: prettyDocuments } = await driveApiClient.reques('fetchDocuments', {
      contractId: stateTransition.getDataContract().getId(),
      type: 'prettyDocument',
    });

    const storedDocumentsJson = stateTransition.getDocuments().map(
      document => document.toJSON(),
    );

    const receivedDocumentsJson = niceDocuments
      .append(prettyDocuments)
      .map(document => document.toJSON());

    expect(storedDocumentsJson).to.have.deep.members(receivedDocumentsJson);
  });
});
