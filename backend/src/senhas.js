'use strict';

const crypto = require('crypto');

const TAMANHO_HASH = 64;

// Formato salvo no banco: scrypt$<sal em hex>$<hash em hex>
function gerarHashDeSenha(senha) {
	const sal = crypto.randomBytes(16);
	const hash = crypto.scryptSync(senha, sal, TAMANHO_HASH);
	return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

function senhaConfere(senha, armazenado) {
	const [, salHex, hashHex] = armazenado.split('$');
	const esperado = Buffer.from(hashHex, 'hex');
	const calculado = crypto.scryptSync(senha, Buffer.from(salHex, 'hex'), esperado.length);
	return crypto.timingSafeEqual(calculado, esperado);
}

module.exports = { gerarHashDeSenha, senhaConfere };
