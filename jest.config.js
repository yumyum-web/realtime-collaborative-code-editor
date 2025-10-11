import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./", // path to your Next.js app
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["<rootDir>/e2e/"],
  transformIgnorePatterns: ["node_modules/(?!(bson|mongodb)/)"],
};

export default createJestConfig(customJestConfig);
