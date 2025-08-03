import path from "path";

const buildEslintCommand = (filenames) =>
  `next lint --fix --file ${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(" --file ")}`;

const lintStagedConfig = {
  "*.{js,jsx,ts,tsx}": [buildEslintCommand],
  "*.{js,jsx,ts,tsx,css,md,json}": ["prettier --write"],
  "package.json": ["sort-package-json"],
};

export default lintStagedConfig;
