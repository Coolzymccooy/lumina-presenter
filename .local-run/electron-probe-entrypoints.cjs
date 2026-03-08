const candidates = ['electron/main', 'electron/common', 'electron/renderer'];
for (const id of candidates) {
  try {
    const value = require(id);
    console.log(id, 'OK', typeof value, Object.keys(value || {}).slice(0, 10).join(','));
  } catch (error) {
    console.log(id, 'ERR', error && error.message ? error.message : String(error));
  }
}
