process.chdir(__dirname);
process.argv.push('--port', '5178', '--host');
import('./node_modules/vite/bin/vite.js');
