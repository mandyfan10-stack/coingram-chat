import fs from 'node:fs';

const rawTag = process.argv[2] || process.env.GITHUB_REF_NAME;
if (!rawTag) {
  throw new Error('Pass a release tag, for example: npm run release:verify -- v1.20.6');
}

const tagVersion = rawTag.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(tagVersion)) {
  throw new Error(`Release tag must use vMAJOR.MINOR.PATCH: ${rawTag}`);
}

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (packageJson.version !== tagVersion) {
  throw new Error(`Tag ${rawTag} does not match package.json version ${packageJson.version}`);
}

const [major, minor, patch] = tagVersion.split('.').map(Number);
if (minor >= 1000 || patch >= 1000) {
  throw new Error('Android versionCode encoding requires minor and patch values below 1000');
}

const androidVersionCode = major * 1_000_000 + minor * 1_000 + patch;
if (androidVersionCode <= 0 || androidVersionCode > 2_100_000_000) {
  throw new Error(`Calculated Android versionCode is out of range: ${androidVersionCode}`);
}

console.log(`Release ${rawTag} is consistent (Android versionCode ${androidVersionCode}).`);