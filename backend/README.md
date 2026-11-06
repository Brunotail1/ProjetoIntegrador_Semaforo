# Back-end do Semáforo

Back-end em Node.js (Express + SQLite) da aplicação Semáforo Inteligente. Ele:

- autentica os usuários e controla o perfil de acesso (administrador e operador);
- guarda usuários, semáforos, estados, falhas e o histórico de comandos no banco;
- envia configurações e comandos ao semáforo e recebe a situação atual e as falhas via MQTT;
- serve as páginas do sistema.

O semáforo (ESP32) é simulado pelos gêmeos digitais ou pelo **MQTTX**.

## Como rodar

É preciso ter o Node 22.13 ou mais novo. Dentro da pasta `backend`:

```powershell
npm install
npm start
```

> No PowerShell, se der erro de "running scripts is disabled", use `npm.cmd start` ou `node server.js`.

Abra **http://localhost:3000** e entre com o usuário inicial:

- E-mail: `admin@sistema.local`
- Senha: `123456`

O front-end também funciona pelo Live Server do VS Code, desde que o back-end esteja rodando na porta 3000.

Para rodar os testes automatizados da API:

```powershell
npm test
```

## Variáveis de ambiente

Todas são opcionais.

| Variável | Padrão | Para que serve |
|---|---|---|
| `PORTA` | `3000` | Porta da API. Se mudar, ajuste também `PORTA_DA_API` em `assets/js/armazenamento.js` |
| `BANCO_DB` | `%USERPROFILE%\.semaforo\banco.db` | Caminho do arquivo do banco |
| `MQTT_URL` | `mqtt://test.mosquitto.org:1883` | Broker usado pelo back-end |
| `TURMA` / `EQUIPE` | `TURMA` / `EQUIPE` | Partes do tópico MQTT. Precisam ser iguais às de `assets/js/aplicacao.js` |

O broker dos gêmeos digitais é definido à parte, em `CONFIGURACAO` no `assets/js/aplicacao.js`. Back-end e front-end precisam usar o mesmo broker.

## Organização do código

| Arquivo | Responsabilidade |
|---|---|
| `server.js` | Ponto de entrada: conecta ao MQTT e sobe a API |
| `src/app.js` | Monta o Express: CORS, rotas, páginas e tratamento de erros |
| `src/config.js` | Configurações e variáveis de ambiente |
| `src/banco.js` | Conexão com o SQLite, tabelas e dados iniciais |
| `src/senhas.js` | Hash e conferência de senhas |
| `src/autenticacao.js` | Sessões e verificações de login e de perfil |
| `src/usuarios.js`, `src/semaforos.js` | Consultas e validações de cada cadastro |
| `src/registros.js` | Estados, falhas e histórico de comandos |
| `src/mqtt.js` | Conexão com o broker, publicação e recebimento |
| `src/rotas/` | Rotas HTTP |
| `public/` | Console de teste do MQTT, em `/console/` |
| `test/` | Testes automatizados da API |

## Rotas HTTP

Com exceção de `POST /login`, todas exigem o cabeçalho `Authorization: Bearer <token>`, com o token devolvido pelo login. A sessão dura 8 horas. Erros voltam como `{"erro":"mensagem"}`.

| Método e rota | Quem pode | O que faz |
|---|---|---|
| `POST /login` | Público | Recebe `{"email","senha"}` e devolve o usuário e o `token` |
| `POST /logout` | Logado | Encerra a sessão |
| `GET /sessao` | Logado | Devolve o usuário logado |
| `GET /painel` | Logado | Totais e último estado de cada semáforo |
| `GET /comandos` | Logado | Histórico de comandos. Filtros: `?dispositivo=sem-a&limite=50` |
| `GET /usuarios` | Admin | Lista os usuários |
| `POST /usuarios` | Admin | Cria um usuário |
| `PUT /usuarios/:id` | Admin | Edita um usuário. Senha em branco mantém a atual |
| `DELETE /usuarios/:id` | Admin | Exclui um usuário |
| `GET /semaforos` | Logado | Lista os semáforos |
| `GET /semaforos/:id` | Logado | Mostra um semáforo |
| `POST /semaforos` | Admin | Cria um semáforo |
| `PUT /semaforos/:id` | Admin | Edita um semáforo. Se os tempos mudarem, envia a configuração |
| `DELETE /semaforos/:id` | Admin | Exclui do cadastro e mantém o histórico |
| `POST /semaforos/:id/configuracao` | Admin | Salva `{"vermelho":5,"amarelo":3,"verde":5}` e envia ao semáforo |
| `POST /semaforos/:id/comando` | Logado | Envia `{"cmd":"verde"}` ao semáforo |
| `GET /semaforos/:id/status` | Logado | Situação atual e últimas 100 falhas |

Exemplo de corpo para criar um semáforo:

```json
{ "id": "sem-c", "nome": "Cruzamento Norte", "localizacao": "Av. Principal, 100",
  "turma": "TURMA01", "equipe": "EQUIPE01", "tempoVermelho": 5, "tempoAmarelo": 3, "tempoVerde": 5 }
```

Exemplo de corpo para criar um usuário (`role` é `admin` ou `operador`):

```json
{ "nome": "João Silva", "email": "joao@exemplo.com", "role": "operador", "senha": "abcd" }
```

Regras aplicadas pelo back-end:

- Tempos entre 1 e 60 segundos (RN05). Pela API, valor fora do limite é recusado; pelo MQTT, é ajustado ao limite, como no simulador.
- O ID do semáforo aceita letras, números, `-` e `_`, porque faz parte do tópico MQTT.
- Ninguém exclui o próprio usuário, e o sistema sempre mantém pelo menos um administrador.
- Trocar a senha de um usuário encerra as sessões abertas dele.
- Com o broker fora do ar, a configuração é salva e a rota responde `202` com `"enviado":false`. O comando não é guardado e a rota responde `503`.

## Configurar o MQTTX (simula o semáforo)

1. **New Connection** → Host `mqtt://test.mosquitto.org`, Port `1883` → **Connect**
2. **New Subscription** → `aps1/semaforo/TURMA/EQUIPE/sem-a/#`

## Tópicos MQTT

Base: `aps1/semaforo/TURMA/EQUIPE/<id>/` (o `<id>` é o ID do semáforo no cadastro, ex.: `sem-a`)

| Sentido | Tópico | Mensagem (JSON) |
|---|---|---|
| Back-end → semáforo | `.../sem-a/configuracao` | `{"vermelho":5,"amarelo":3,"verde":5,"origem":"backend"}` (segundos) |
| Back-end → semáforo | `.../sem-a/comando` | `{"cmd":"verde","origem":"backend"}` |
| Semáforo → back-end | `.../sem-a/estado` | `{"estado":"GREEN"}` (`RED`, `YELLOW`, `GREEN` ou `BLINK_YELLOW`) |
| Semáforo → back-end | `.../sem-a/falha` | `{"luz":"vermelho"}` |

O campo `origem` evita que o back-end registre em dobro o que ele mesmo publicou. O back-end também escuta `comando` e `configuracao` publicados por fora, como pelo MQTTX: os dois entram no histórico, e os tempos recebidos são salvos no cadastro.

## Testando com o MQTTX

Abra **http://localhost:3000/console/** na mesma aba em que fez o login.

1. **Enviar configuração:** no console, preencha os tempos e clique em **Enviar** → a mensagem chega no MQTTX.
2. **Enviar estado:** no MQTTX, publique `{"estado":"GREEN"}` em `aps1/semaforo/TURMA/EQUIPE/sem-a/estado` → aparece no console e no painel.
3. **Enviar falha:** no MQTTX, publique `{"luz":"vermelho"}` em `aps1/semaforo/TURMA/EQUIPE/sem-a/falha` → aparece no console.

## Banco de dados (SQLite)

O banco fica em `%USERPROFILE%\.semaforo\banco.db`, fora do projeto, pra gravação não fazer o Live Server recarregar a página. Ele é criado automaticamente na primeira execução (usa o `node:sqlite`, embutido no Node, sem instalar nada). Um banco de versões anteriores é aproveitado: os estados e as falhas já gravados são mantidos.

| Tabela | Conteúdo |
|---|---|
| `usuarios` | Usuários, com a senha guardada só como hash (scrypt) |
| `sessoes` | Sessões abertas, com o token guardado só como hash |
| `semaforos` | Cadastro de semáforos e tempos de cada cor |
| `estados` | Cada situação recebida do semáforo |
| `falhas` | Cada falha recebida do semáforo |
| `comandos` | Histórico de comandos e configurações (RN07) |

Na primeira execução o banco recebe o administrador inicial e os semáforos `sem-a` e `sem-b`.

Para consultar pelo terminal:

```powershell
sqlite3 "$env:USERPROFILE\.semaforo\banco.db" "select * from estados; select * from falhas; select * from comandos;"
```
