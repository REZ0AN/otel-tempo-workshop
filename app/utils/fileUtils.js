const fs = require('fs/promises');
const path = require('path');

function generateRandomContent() {
  const randomContent = {
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    data: Array.from({ length: 10 }, () => Math.random().toString(36).substring(7)),
    message: 'This is random test data for file operations'
  };
  return {
    content: randomContent,
    stringified: JSON.stringify(randomContent),
  };
}

function buildFilePath(id) {
  const filename = `temp_${id}_${Date.now()}.json`;
  return {
    filename,
    filepath: path.join(__dirname, '..', 'temp', filename)
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFile(filepath, content) {
  await fs.writeFile(filepath, content, 'utf8');
}

async function readFile(filepath) {
  const content = await fs.readFile(filepath, 'utf8');
  return JSON.parse(content);
}

async function deleteFile(filepath) {
  await fs.unlink(filepath);
}

module.exports = {
  generateRandomContent,
  buildFilePath,
  ensureDir,
  writeFile,
  readFile,
  deleteFile
};
