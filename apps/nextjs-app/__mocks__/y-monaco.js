// Mock for y-monaco library

const mockBinding = {
  destroy: jest.fn(),
};

// Mock MonacoBinding constructor
const MonacoBinding = jest.fn().mockImplementation(() => mockBinding);

module.exports = {
  MonacoBinding,
  mockBinding,
};
