import path from "path";

const buildEslintCommand = (filenames) => {
  const filtered = filenames.filter((f) => !f.includes("apache-jmeter-5.6.3"));
  if (filtered.length === 0) return [];
  return `next lint --fix --file ${filtered
    .map((f) => path.relative(process.cwd(), f))
    .join(" --file ")}`;
};

const buildPrettierCommand = (filenames) => {
  const filtered = filenames.filter((f) => !f.includes("apache-jmeter-5.6.3"));
  return filtered.length > 0 ? `prettier --write ${filtered.join(" ")}` : [];
};

const lintStagedConfig = {
  "*.{js,jsx,ts,tsx}": [buildEslintCommand],
  "*.{js,jsx,ts,tsx,css,md,json}": [buildPrettierCommand],
  "package.json": ["sort-package-json"],
};

export default lintStagedConfig;
