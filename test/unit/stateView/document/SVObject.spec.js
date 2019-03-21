const SVObject = require('../../../../lib/stateView/document/SVObject');

const getDocumentsFixture = require('../../../../lib/test/fixtures/getDocumentsFixture');
const getReferenceFixture = require('../../../../lib/test/fixtures/getReferenceFixture');

describe('SVObject', () => {
  let svObject;
  let userId;
  let document;
  let reference;
  let isDeleted;
  let previousRevisions;

  beforeEach(() => {
    ({ userId } = getDocumentsFixture);
    [document] = getDocumentsFixture();
    reference = getReferenceFixture();
    isDeleted = false;
    previousRevisions = [];

    svObject = new SVObject(
      userId,
      document,
      reference,
      isDeleted,
      previousRevisions,
    );
  });

  describe('#getUserId', () => {
    it('should return user ID', () => {
      const result = svObject.getUserId();

      expect(result).to.equal(userId);
    });
  });

  describe('#getDocument', () => {
    it('should return DP Object', () => {
      const result = svObject.getDocument();

      expect(result.toJSON()).to.deep.equal(document.toJSON());
    });
  });

  describe('#markAsDeleted', () => {
    it('should mark object as deleted', () => {
      const result = svObject.markAsDeleted();

      expect(result).to.equal(svObject);

      expect(svObject.deleted).to.be.true();
    });
  });

  describe('#isDeleted', () => {
    it('should return true if object is deleted', () => {
      const result = svObject.isDeleted();

      expect(result).to.be.false();
    });
  });

  describe('#toJSON', () => {
    it('should return SVObject as a plain object', () => {
      const result = svObject.toJSON();

      expect(result).to.deep.equal({
        userId,
        document: document.toJSON(),
        reference: reference.toJSON(),
        isDeleted,
        previousRevisions,
      });
    });
  });
});
