import{spawn}from'node:child_process';
const node=process.execPath;const api=spawn(node,['server/index.js'],{stdio:'inherit'});const web=spawn(node,['node_modules/vite/bin/vite.js','--host','0.0.0.0'],{stdio:'inherit'});const stop=()=>{api.kill();web.kill()};process.on('SIGINT',stop);process.on('SIGTERM',stop);
