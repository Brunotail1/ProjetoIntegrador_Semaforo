# Back-end do Semáforo (MQTT)

Back-end em Node.js que envia configurações ao semáforo e recebe a situação atual e as falhas via MQTT.
O semáforo (ESP32) é simulado pelo **MQTTX**.

## Como rodar

Dentro da pasta `backend`:

```powershell
npm install
npm start
```

> No PowerShell, se der erro de "running scripts is disabled", use `npm.cmd start` ou `node server.js`.

Abra **http://localhost:3000** para usar a tela.

## Configurar o MQTTX (simula o semáforo)

1. **New Connection** → Host `mqtt://test.mosquitto.org`, Port `1883` → **Connect**
2. **New Subscription** → `aps1/semaforo/TURMA/equipe-brunotintimario/sem-a/#`

## Tópicos MQTT

Base: `aps1/semaforo/TURMA/equipe-brunotintimario/<id>/` (o `<id>` é o mesmo do campo "ID do semáforo" da tela, ex.: `sem-a`)

| Sentido | Tópico | Mensagem (JSON) |
|---|---|---|
| Back-end → semáforo | `.../sem-a/configuracao` | `{"vermelho":5,"amarelo":3,"verde":5}` (segundos) |
| Semáforo → back-end | `.../sem-a/estado` | `{"estado":"GREEN"}` (`RED`, `YELLOW`, `GREEN` ou `BLINK_YELLOW`) |
| Semáforo → back-end | `.../sem-a/falha` | `{"luz":"vermelho"}` |

## Testando

1. **Enviar configuração:** na tela, preencha os tempos e clique em **Enviar** → a mensagem chega no MQTTX.
2. **Enviar estado:** no MQTTX, publique `{"estado":"GREEN"}` em `aps1/semaforo/TURMA/equipe-brunotintimario/sem-a/estado` → aparece na tela.
3. **Enviar falha:** no MQTTX, publique `{"luz":"vermelho"}` em `aps1/semaforo/TURMA/equipe-brunotintimario/sem-a/falha` → aparece na tela.

## Rotas HTTP

- `POST /semaforos/:id/configuracao` — envia a configuração ao semáforo
- `GET /semaforos/:id/status` — mostra a situação atual e as falhas recebidas

## Banco de dados (SQLite)

Os status recebidos do semáforo ficam salvos no arquivo `%USERPROFILE%\.semaforo\banco.db` (fora do projeto, pra gravação não fazer o Live Server recarregar a página; troque com a variável `BANCO_DB`), criado automaticamente na primeira execução (usa o `node:sqlite`, embutido no Node 22.5+, sem instalar nada).

- Tabela `estados` — cada situação atual recebida (`id_dispositivo`, `estado`, `payload`, `recebido_em`)
- Tabela `falhas` — cada falha recebida (`id_dispositivo`, `luz`, `payload`, `recebido_em`)

Para consultar pelo terminal:

```powershell
sqlite3 "$env:USERPROFILE\.semaforo\banco.db" "select * from estados; select * from falhas;"
```
