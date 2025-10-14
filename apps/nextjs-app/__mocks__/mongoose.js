// Mock for mongoose to avoid MongoDB/BSON issues

const mockSchema = jest.fn(function () {
  this.Types = {
    ObjectId: class MockObjectId {},
    Mixed: jest.fn(),
  };
  return this;
});

const mongoose = {
  connect: jest.fn().mockResolvedValue(undefined),
  connection: {
    readyState: 1,
  },
  models: {},
  model: jest.fn(),
  Schema: mockSchema,
  Types: {
    ObjectId: class MockObjectId {
      constructor(id) {
        this.id = id;
      }
      toString() {
        return this.id || "mock-object-id";
      }
    },
    Mixed: jest.fn(),
  },
};

module.exports = mongoose;
module.exports.default = mongoose;
