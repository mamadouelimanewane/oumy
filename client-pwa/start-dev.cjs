process.chdir(__dirname);
process.argv.push('--port', '5173');
require('child_process').execSync('node node_modules/vite/bin/vite.js --port 5173', { stdio: 'inherit', cwd: __dirname });
