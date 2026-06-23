import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const child = spawn('python3', ['scripts/run-shodan.py', ...args], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
