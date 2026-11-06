'use strict';

const { CAMINHO_BANCO, PORTA } = require('./src/config');
const { criarApp } = require('./src/app');
const { conectarMqtt } = require('./src/mqtt');

console.log('Banco SQLite em', CAMINHO_BANCO);
conectarMqtt();
criarApp().listen(PORTA, () => console.log(`Aplicação em http://localhost:${PORTA}`));
