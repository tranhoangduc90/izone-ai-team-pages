// Chỉ là adapter môi trường test: không sửa nguồn/giao diện K67.
const fs = require('node:fs');
const { chromium } = require('playwright');
const original = chromium.launch.bind(chromium);
chromium.launch = options => {
  const resolved = {...options};
  if (resolved.executablePath && !fs.existsSync(resolved.executablePath)) {
    delete resolved.executablePath;
    resolved.channel = 'chrome';
  }
  return original(resolved);
};
