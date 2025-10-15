import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Mock ESM-only modules
    "^socket\\.io-client$": "<rootDir>/__mocks__/socket.io-client.js",
    "^monaco-editor$": "<rootDir>/__mocks__/monaco-editor.js",
    "^y-monaco$": "<rootDir>/__mocks__/y-monaco.js",
    "^yjs$": "<rootDir>/__mocks__/yjs.js",
    "^y-websocket$": "<rootDir>/__mocks__/y-websocket.js",
    "^mongoose$": "<rootDir>/__mocks__/mongoose.js",
    "^@repo/database$": "<rootDir>/__mocks__/@repo/database.js",
  },
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
  transformIgnorePatterns: [
    // packages that have ESM issues
    "node_modules/(?!(bson|mongodb|mongoose|yjs|y-websocket|@repo|socket\\.io-client|monaco-editor|y-monaco)/)",
  ],
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs"],
};

export default createJestConfig(customJestConfig);
