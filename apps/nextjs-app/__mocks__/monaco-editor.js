module.exports = {
  editor: {
    create: jest.fn(),
    defineTheme: jest.fn(),
    setTheme: jest.fn(),
  },
  languages: {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
  },
};
