'use strict';

const { encodePasswordHash } = require('../admin-auth');

function readHidden(prompt) {
    return new Promise((resolve, reject) => {
        if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
            reject(new Error('Execute este comando em um terminal interativo.'));
            return;
        }
        let value = '';
        process.stderr.write(prompt);
        process.stdin.setRawMode(true);
        process.stdin.setEncoding('utf8');
        process.stdin.resume();

        const cleanup = () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            process.stderr.write('\n');
        };
        const onData = chunk => {
            for (const char of chunk) {
                if (char === '\u0003') {
                    cleanup();
                    reject(new Error('Operação cancelada.'));
                    return;
                }
                if (char === '\r' || char === '\n') {
                    cleanup();
                    resolve(value);
                    return;
                }
                if (char === '\u007f' || char === '\b') {
                    value = value.slice(0, -1);
                    continue;
                }
                if (char >= ' ') value += char;
            }
        };
        process.stdin.on('data', onData);
    });
}

async function main() {
    const password = await readHidden('Senha administrativa (mínimo 16 caracteres): ');
    const confirmation = await readHidden('Confirme a senha: ');
    if (password !== confirmation) throw new Error('As senhas não conferem.');
    process.stdout.write(`${encodePasswordHash(password)}\n`);
}

main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
