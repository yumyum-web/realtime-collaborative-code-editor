// Mock for y-websocket library

const mockAwareness = {
  setLocalStateField: jest.fn(),
  getStates: jest.fn(() => new Map()),
  on: jest.fn(),
  off: jest.fn(),
  clientID: 1,
};

const mockProvider = {
  awareness: mockAwareness,
  destroy: jest.fn(),
  synced: true,
  on: jest.fn(),
  off: jest.fn(),
};

// Mock WebsocketProvider constructor
const WebsocketProvider = jest.fn().mockImplementation(() => mockProvider);

module.exports = {
  WebsocketProvider,
  mockProvider,
  mockAwareness,
};
