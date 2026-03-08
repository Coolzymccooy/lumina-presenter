console.log('VERS', process.versions.electron);
console.log('BUILTINS', require('module').builtinModules.filter((m) => m.includes('electron')).join(','));
try { const mod = require('electron'); console.log('ELECTRON_TYPE', typeof mod); console.log('ELECTRON_VALUE', mod); } catch (err) { console.error('REQ_ELECTRON_ERR', err && err.message); }
try { const mod = require('electron/main'); console.log('ELECTRON_MAIN_TYPE', typeof mod); console.log('ELECTRON_MAIN_KEYS', Object.keys(mod || {}).slice(0,20).join(',')); } catch (err) { console.error('REQ_ELECTRON_MAIN_ERR', err && err.message); }
try { const mod = require('electron/common'); console.log('ELECTRON_COMMON_TYPE', typeof mod); console.log('ELECTRON_COMMON_KEYS', Object.keys(mod || {}).slice(0,20).join(',')); } catch (err) { console.error('REQ_ELECTRON_COMMON_ERR', err && err.message); }
