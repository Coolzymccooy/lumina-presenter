for (const spec of ['node:electron', 'node:electron/main', 'node:electron/renderer']) {
  try {
    const mod = require(spec);
    console.log(spec, 'OK', typeof mod, Object.keys(mod || {}).slice(0,10).join(','));
  } catch (err) {
    console.log(spec, 'ERR', err && err.message);
  }
}
