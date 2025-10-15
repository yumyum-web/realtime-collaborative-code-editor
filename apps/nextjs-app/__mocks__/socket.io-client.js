const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
  id: "socket123",
};

module.exports = jest.fn(() => mockSocket);
module.exports.default = jest.fn(() => mockSocket);
