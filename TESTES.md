# Roteiro de testes — Semáforo Inteligente

Passo a passo para instalar, rodar e testar o projeto **em outra máquina** (Windows).
Cada teste diz o que fazer e o que deve acontecer. Tudo aqui foi testado em uma cópia limpa do repositório.

> Comandos para o **PowerShell** do Windows. No PowerShell 5.1 (o padrão) **não existe `&&`**:
> rode um comando por linha.

---

## 1. O que precisa estar instalado

| Programa | Versão | Para quê | Como conferir |
|---|---|---|---|
| **Node.js** | **22.13 ou maior** (recomendado: 24 LTS) | rodar o back-end e o banco SQLite embutido | `node --version` |
| **Git** | qualquer | baixar o projeto | `git --version` |
| **MQTTX** | qualquer | simular o semáforo (ESP32) pelo MQTT | abrir o programa |
| Navegador | Chrome, Edge ou Firefox | usar o sistema | — |

- Node: https://nodejs.org (baixe o instalador **LTS**).
- MQTTX: https://mqttx.app.
- **Não precisa instalar banco de dados nem Mosquitto.** O banco é o SQLite que já vem dentro do Node, e o broker é o público `test.mosquitto.org`.
- A máquina precisa de **internet**, porque o broker MQTT fica na internet.

---

## 2. Baixar e instalar

```powershell
git clone -b dev https://github.com/Brunotail1/ProjetoIntegrador_Semaforo.git
```

```powershell
cd ProjetoIntegrador_Semaforo\backend
```

```powershell
npm.cmd install
```

> Use `npm.cmd` em vez de `npm`. Em muitas máquinas o PowerShell bloqueia o `npm` com o erro
> *"a execução de scripts foi desabilitada neste sistema"*. O `npm.cmd` funciona sem mudar nenhuma configuração.

## 3. Testes automatizados

Ainda dentro de `backend`:

```powershell
npm.cmd test
```

**Esperado:** `tests 21`, `pass 21`, `fail 0`.
Os testes usam um banco em memória: não sujam o banco de verdade e não precisam de internet.

## 4. Subir o servidor

```powershell
npm.cmd start
```

**Esperado** no terminal:

```
Banco SQLite em C:\Users\<usuário>\.semaforo\banco.db
Aplicação em http://localhost:3000
Back-end conectado ao broker MQTT
```

- **Deixe esse terminal aberto** enquanto testa. Fechou o terminal, parou o servidor (`Ctrl+C` também para).
- Na primeira execução o banco é criado sozinho, com:
  - o usuário **admin@sistema.local / 123456**;
  - os semáforos **sem-a** e **sem-b** (tempos 5/3/5 s).

Abra no navegador: **http://localhost:3000**

---

## 5. Roteiro das telas (checklist)

Marque cada item conforme testar.

### 5.1 Login

- [ ] Abrir http://localhost:3000. Você é levado para a tela de **login**.
- [ ] Clicar em **Entrar** com os campos vazios → *"Preencha e-mail e senha."*
- [ ] Senha errada → *"E-mail ou senha incorretos."*
- [ ] `admin@sistema.local` / `123456` → abre o **Painel**.

### 5.2 Painel

- [ ] Mostra **2 Semáforos Cadastrados** e **1 Usuário Cadastrado** (num banco novo).
- [ ] "Status ao Vivo" fica vazio até chegar o primeiro estado (próximo passo).
- [ ] O painel se atualiza sozinho a cada 3 segundos.

### 5.3 Gêmeos Digitais

- [ ] Menu **Gêmeos Digitais** → aparecem os semáforos **sem-a** e **sem-b**, parados no **vermelho**.
- [ ] Clicar num semáforo → abre o detalhe com o **tópico MQTT de comando** e o exemplo de payload `{"cmd":"verde"}`.
- [ ] Bloco **Simulação Local**: os botões Vermelho / Amarelo / Verde / Intermitente / Automático mudam o semáforo simulado da tela. Esse bloco funciona até sem internet (RN06).

> **Importante:** os gêmeos **sem-a** e **sem-b** fazem o papel do semáforo físico. Eles só mudam de cor quando
> chega um comando pelo MQTT (MQTTX ou API), e são eles que respondem com o **estado**.
> Para o painel e o histórico receberem estados, **deixe a tela Gêmeos Digitais aberta numa aba**.

### 5.4 Cadastro de Semáforos (admin)

- [ ] **Novo Semáforo** com ID `sem-c`, nome `Semáforo C` e tempos 10 / 4 / 12 → aparece na tabela.
- [ ] Tentar criar outro com ID `sem-c` → *"Já existe um semáforo com o ID "sem-c"."*
- [ ] ID com espaço ou barra (ex.: `sem c`, `a/b`) → erro (o ID vira parte do tópico MQTT).
- [ ] Tempo `0` ou `61` → erro *"…deve ser entre 1 e 60 segundos"* (**RN05**).
- [ ] **Editar** o `sem-c` e mudar os tempos → no MQTTX chega a mensagem em `.../sem-c/configuracao`.
- [ ] O `sem-c` aparece em **Gêmeos Digitais** e no Painel.
- [ ] **Excluir** o `sem-c` → some da tabela, dos gêmeos e do contador.

### 5.5 Cadastro de Usuários (admin)

- [ ] **Novo Usuário**: `Operador Teste`, `op@teste.com`, perfil **Operador**, senha `abcd` (2×) → aparece na tabela.
- [ ] Repetir o mesmo e-mail → *"Já existe um usuário com esse e-mail."*
- [ ] Senhas diferentes → *"As senhas não coincidem."*
- [ ] Senha com menos de 4 caracteres → erro.
- [ ] **Editar** e deixar a senha em branco → mantém a senha atual.
- [ ] Tentar **excluir o próprio admin** → *"Você não pode excluir seu próprio usuário."*
- [ ] Editar o admin e mudar o perfil para Operador → *"O sistema precisa de pelo menos um administrador."*

### 5.6 Perfil Operador

- [ ] Clicar em **Sair** (canto do menu) → volta ao login.
- [ ] Entrar com `op@teste.com` / `abcd`.
- [ ] No Painel, o botão de atalho **Usuários** (em Ações Rápidas) não aparece.
- [ ] Clicar em **Usuários** no menu do topo (ou abrir http://localhost:3000/usuarios.html) → volta para o Painel.
- [ ] Em **Semáforos**, o operador vê a lista, mas **sem** o botão Novo Semáforo e sem Editar/Excluir. A API também recusa com 403.
- [ ] **Sair** e entrar de novo como admin.

### 5.7 Console do back-end

- [ ] Logado, abrir **http://localhost:3000/console**.
- [ ] Mostra o status ao vivo do semáforo escolhido (`sem-a`) e as falhas recebidas.
- [ ] Preencher os tempos e clicar em **Enviar** → a configuração é publicada no MQTT (aparece no MQTTX).
- [ ] Sem estar logado, o console manda para o login.

---

## 6. Teste do MQTT com o MQTTX

### 6.1 Conexão

No MQTTX: **New Connection**:

| Campo | Valor |
|---|---|
| Name | `semaforo` (qualquer) |
| Host | `mqtt://` + `test.mosquitto.org` |
| Port | `1883` |
| Client ID | deixe o gerado |
| Usuário / senha | em branco |

Clique em **Connect**. Depois, **New Subscription** com o tópico:

```
aps1/semaforo/TURMA/EQUIPE/#
```

Isso mostra **tudo** o que os semáforos e o back-end trocam.

> Antes de publicar, deixe a tela **Gêmeos Digitais** aberta no navegador.
> No campo de publicar do MQTTX, escolha o formato **JSON**.
>
> **Cuidado ao digitar o payload:** o editor do MQTTX fecha `{` e `"` sozinho. Se você digitar o JSON inteiro,
> sobra um `"}` no final e aparece *"Publish message SyntaxError: Unexpected non-whitespace character after JSON"*.
> Apague o que sobrou depois do último `}`, ou **cole** o payload em vez de digitar.

### 6.2 Mensagens para testar

O tópico base é `aps1/semaforo/TURMA/EQUIPE/sem-a/`. Troque `sem-a` por `sem-b` para testar o outro.

| # | Publicar no tópico | Payload | O que deve acontecer |
|---|---|---|---|
| 1 | `.../sem-a/comando` | `{"cmd":"verde"}` | O gêmeo **sem-a fica verde** na tela. No MQTTX chega a resposta em `.../sem-a/estado` com `"estado":"GREEN"`. O Painel mostra *Semáforo A · Verde*. |
| 2 | `.../sem-a/comando` | `{"cmd":"amarelo"}` / `{"cmd":"vermelho"}` | O gêmeo muda para a cor pedida e fica parado nela. |
| 3 | `.../sem-a/comando` | `{"cmd":"automatico"}` | O gêmeo volta a ciclar sozinho: vermelho → verde → amarelo. |
| 4 | `.../sem-a/comando` | `{"cmd":"intermitente"}` | O gêmeo fica **amarelo piscando** (modo de segurança). |
| 5 | `.../sem-a/configuracao` | `{"vermelho":10,"amarelo":3,"verde":8}` | Na tela **Semáforos**, o sem-a passa a mostrar **10 / 3 / 8**, e o gêmeo usa os novos tempos. |
| 6 | `.../sem-a/configuracao` | `{"vermelho":999,"amarelo":0,"verde":8}` | Valores fora da faixa são **limitados**: o cadastro fica **60 / 1 / 8** (**RN05**). |
| 7 | `.../sem-a/falha` | `{"luz":"vermelho"}` | A falha é gravada no banco e aparece no `/console`. O gêmeo entra em **intermitente** e publica `"estado":"BLINK_YELLOW"`. |
| 8 | `.../sem-a/estado` | `{"estado":"GREEN"}` | Gravado como último estado do sem-a: aparece no Painel e no `/console`. |

Depois do teste 6, volte os tempos ao normal: tela **Semáforos** → Editar sem-a → 5 / 3 / 5.

### 6.3 Do sistema para o MQTTX

| Ação no sistema | O que chega no MQTTX |
|---|---|
| Editar os tempos de um semáforo na tela **Semáforos** | `.../<id>/configuracao` com `{"vermelho":…,"amarelo":…,"verde":…,"origem":"backend"}` |
| **Enviar** no `/console` | o mesmo, em `.../<id>/configuracao` |
| Comando pela API (seção 7) | `.../<id>/comando` com `{"cmd":"…","origem":"backend"}` |
| Gêmeos Digitais aberto | `.../<id>/sincronizacao` a cada ~5 s (`{"status":"ok"}`) e `.../<id>/estado` a cada troca de cor |

O campo `"origem":"backend"` serve para o back-end não gravar em dobro o que ele mesmo publicou.

### 6.4 Histórico de comandos (RN07)

Todo comando e configuração, venha do MQTTX (`origem: MQTT`) ou da API (`origem: API`, com o e-mail de quem enviou), fica no banco.
Para ver, use a API da seção 7 (`/comandos`).

---

## 7. Teste da API pelo PowerShell (opcional)

Com o servidor rodando, em **outro** terminal:

```powershell
$s = Invoke-RestMethod -Method Post http://localhost:3000/login -ContentType 'application/json' -Body '{"email":"admin@sistema.local","senha":"123456"}'
$h = @{ Authorization = "Bearer $($s.token)" }
```

```powershell
# Mandar o sem-a ficar verde (o gêmeo precisa estar aberto para responder)
Invoke-RestMethod -Method Post http://localhost:3000/semaforos/sem-a/comando -Headers $h -ContentType 'application/json' -Body '{"cmd":"verde"}'
```

```powershell
# Mudar os tempos (só admin)
Invoke-RestMethod -Method Post http://localhost:3000/semaforos/sem-a/configuracao -Headers $h -ContentType 'application/json' -Body '{"vermelho":5,"amarelo":3,"verde":5}'
```

```powershell
# Último estado e falhas do sem-a
Invoke-RestMethod http://localhost:3000/semaforos/sem-a/status -Headers $h | ConvertTo-Json -Depth 4
```

```powershell
# Histórico de comandos (RN07)
Invoke-RestMethod "http://localhost:3000/comandos?dispositivo=sem-a&limite=10" -Headers $h | Format-Table
```

```powershell
# Dados do painel
Invoke-RestMethod http://localhost:3000/painel -Headers $h | ConvertTo-Json -Depth 4
```

Respostas esperadas:

| Situação | Código |
|---|---|
| Deu certo | `200` (`{"enviado":true,...}`) |
| Dado inválido (ex.: tempo 0, comando `azul`) | `400` com a mensagem de erro |
| Sem login / token vencido / depois do logout | `401` |
| Operador tentando ação de admin | `403` |
| Comando com o broker fora do ar | `503` *"Broker MQTT indisponível. O comando não foi enviado."* |
| Configuração com o broker fora do ar | `202` `{"enviado":false}`: salva no banco, mas não chega no semáforo |

A lista completa de rotas está em [`backend/README.md`](backend/README.md).

---

## 8. Usando o Live Server do VS Code (opcional)

O front-end também abre pelo **Live Server** (ex.: `http://127.0.0.1:5500/login.html`). Testado e funcionando.

- O **back-end precisa estar rodando** na porta 3000 (`npm.cmd start`), porque é ele que tem a API e o banco.
- **Não** abra os arquivos `.html` direto com dois cliques (`file:///...`). Nesse caso o navegador bloqueia a API e o login falha.
  Use `http://localhost:3000` ou o Live Server.

---

## 9. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| *"Não foi possível conectar ao servidor. Verifique se o back-end está rodando."* | servidor parado, ou página aberta por `file:///` | Rodar `npm.cmd start` na pasta `backend` e abrir **http://localhost:3000** |
| `npm : ... a execução de scripts foi desabilitada` | política do PowerShell | Usar `npm.cmd install` / `npm.cmd start` |
| `O token '&&' não é um separador de instruções válido` | PowerShell 5.1 não tem `&&` | Rodar um comando por linha: `cd backend`, depois `npm.cmd start` |
| `Cannot find module 'express'` | faltou instalar dependências, ou terminal na pasta errada | Entrar em `backend` e rodar `npm.cmd install` |
| `No such built-in module: node:sqlite` ou erro de versão | Node antigo | Instalar o Node **22.13+** (de preferência 24 LTS) e abrir um **novo** terminal |
| *"A porta 3000 já está em uso"* | outro servidor já aberto (em outro terminal ou no VS Code) | Fechar o outro servidor (`Ctrl+C` no terminal dele). Se não achar: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess`. Não troque a porta: o front-end procura a API sempre na 3000 |
| Terminal mostra `Erro no MQTT: ...` repetido; gêmeos não respondem | sem internet, firewall/rede da escola bloqueando a porta 1883/8080, ou `test.mosquitto.org` fora do ar | Testar outra rede (ex.: 4G do celular). O resto do sistema (login, cadastros, painel) continua funcionando |
| Comando enviado, mas o estado não muda no Painel | a tela **Gêmeos Digitais** não está aberta | Abrir Gêmeos Digitais numa aba e mandar o comando de novo |
| Quero começar do zero (banco limpo) | — | Parar o servidor e apagar `%USERPROFILE%\.semaforo\banco.db`. Na próxima execução ele é recriado com o admin e o sem-a/sem-b |

> O `test.mosquitto.org` é um broker **público e gratuito**: às vezes fica lento ou cai por alguns minutos, e qualquer
> pessoa pode ver as mensagens. Se ele cair, espere um pouco e reinicie o servidor.

---

## 10. Resumo rápido (para quem já conhece)

```powershell
git clone -b dev https://github.com/Brunotail1/ProjetoIntegrador_Semaforo.git
cd ProjetoIntegrador_Semaforo\backend
npm.cmd install
npm.cmd test
npm.cmd start
```

Abrir http://localhost:3000 → `admin@sistema.local` / `123456` → abrir **Gêmeos Digitais** →
no MQTTX (`test.mosquitto.org:1883`) publicar `{"cmd":"verde"}` em `aps1/semaforo/TURMA/EQUIPE/sem-a/comando`
→ o gêmeo fica verde e o Painel mostra *Verde*.
