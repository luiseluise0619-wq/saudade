'use strict';

const { spawn } = require('node:child_process');

const candidates = [
    ['python3', ['serve.py']],
    ['python', ['serve.py']],
    ['py', ['-3', 'serve.py']],
];

function launch(index) {
    if (index >= candidates.length) {
        console.error('Unable to find a Python runtime. Tried python3, python, and py -3.');
        process.exit(1);
        return;
    }

    const [command, args] = candidates[index];
    const child = spawn(command, args, {
        stdio: 'inherit',
    });

    child.on('error', () => launch(index + 1));
    child.on('exit', (code) => process.exit(code ?? 0));
}

launch(0);
