// Mock for yjs library

const mockYText = {
  insert: jest.fn(),
  delete: jest.fn(),
  length: 0,
  toString: jest.fn(() => ""),
  observe: jest.fn(),
  unobserve: jest.fn(),
};

const mockYMap = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockYDoc = {
  getText: jest.fn(() => mockYText),
  getMap: jest.fn(() => mockYMap),
  destroy: jest.fn(),
  isDestroyed: false,
};

// Mock Y.Doc constructor
const Doc = jest.fn().mockImplementation(() => mockYDoc);

module.exports = {
  Doc,
  mockYDoc,
  mockYText,
  mockYMap,
};
