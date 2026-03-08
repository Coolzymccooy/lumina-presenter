console.log('ELECTRON', process.versions.electron);
console.log('REQ_TYPE', typeof require('electron'));
console.log('REQ_VALUE', require('electron'));
console.log('BUILTINS', require('module').builtinModules.filter((m) => m.includes('electron')).join(','));
