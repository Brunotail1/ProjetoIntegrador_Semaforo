'use strict';

const { CAMINHO_BANCO, PORTA } = require('./src/config');
const { criarApp } = require('./src/app');
const { conectarMqtt } = require('./src/mqtt');

console.log('Banco SQLite em', CAMINHO_BANCO);
conectarMqtt();
const servidor = criarApp().listen(PORTA, () => console.log(`Aplicação em http://localhost:${PORTA}`));

servidor.on('error', (erro) => {
	if (erro.code === 'EADDRINUSE') {
		console.error(`A porta ${PORTA} já está em uso (o servidor já está aberto em outro terminal?).`);
		console.error('Feche o outro servidor (Ctrl+C no terminal dele) e rode npm.cmd start de novo.');
	} else {
		console.error('Erro ao iniciar o servidor:', erro.message);
	}
	process.exit(1);
});
