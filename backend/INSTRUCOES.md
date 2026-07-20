# 📦 Como conectar o sistema ao seu Google Drive + Sheets

Este guia liga o formulário e o painel (site) à sua conta Google, sem expor senha nenhuma
no site. O "motor" (`Codigo.gs`) roda dentro da sua conta, nos servidores do Google.

Tempo estimado: ~10 minutos. Você só precisa de uma conta Google.

---

## Passo 1 — Criar a pasta no Google Drive
1. Acesse https://drive.google.com e crie uma pasta (ex.: **"Dados Clientes"**).
2. Abra a pasta. Na URL vai aparecer algo assim:
   `https://drive.google.com/drive/folders/`**`1AbC...XyZ`**
3. Copie esse código depois de `/folders/` — é o **ID DA PASTA**.

## Passo 2 — Criar a planilha
1. Acesse https://sheets.google.com e crie uma planilha em branco (ex.: **"Banco de Dados"**).
2. Na URL vai aparecer: `https://docs.google.com/spreadsheets/d/`**`1QwE...RtY`**`/edit`
3. Copie o código entre `/d/` e `/edit` — é o **ID DA PLANILHA**.
   (Não precisa criar colunas; o sistema cria sozinho.)

## Passo 3 — Colar o script
1. Ainda na planilha, clique em **Extensões → Apps Script**.
2. Apague qualquer código que aparecer e **cole todo o conteúdo** do arquivo
   [`Codigo.gs`](./Codigo.gs).
3. No topo do código, preencha os 3 valores:
   - `PLANILHA_ID` → o ID do Passo 2
   - `PASTA_DRIVE_ID` → o ID do Passo 1
   - `API_TOKEN` → **invente uma senha forte** (ex.: `capitao-2026-XK7q`). Anote, você vai
     usar a MESMA no Passo 5.
4. Clique no disquete (💾 Salvar).

## Passo 4 — Publicar como App da Web
1. No editor do Apps Script, clique em **Implantar → Nova implantação**.
2. Em "Tipo", escolha **App da Web**.
3. Configure:
   - **Executar como:** *Eu (sua conta)*
   - **Quem pode acessar:** *Qualquer pessoa*
4. Clique **Implantar**. O Google vai pedir para **autorizar** — aceite (é a sua própria conta).
5. Copie a **URL do app da Web** que aparece (termina em `/exec`).

## Passo 5 — Conectar o site
1. Abra o arquivo [`../sistema/config.js`](../sistema/config.js).
2. Cole a URL no `WEB_APP_URL` e a mesma senha no `API_TOKEN`:
   ```js
   const CONFIG = {
     WEB_APP_URL: 'https://script.google.com/macros/s/SEU_ID/exec',
     API_TOKEN: 'capitao-2026-XK7q'
   }
   ```
3. Pronto! Abra `sistema/cadastro.html`, faça um cadastro de teste e confira:
   - uma nova linha apareceu na planilha;
   - se anexou arquivo, ele está na pasta do Drive;
   - o `sistema/painel.html` mostra os dados e o gráfico.

---

## ⚠️ Segurança e LGPD (importante)
- O `API_TOKEN` no site é uma proteção **leve** (fica visível para quem inspeciona a página).
  Serve para evitar envios casuais, não é segurança de nível bancário. Para dados sensíveis,
  considere depois um backend dedicado com autenticação real.
- Você está coletando dados de clientes: pela **LGPD**, colete só o necessário, informe a
  finalidade e tenha consentimento.
- Sempre que mudar o `Codigo.gs`, refaça **Implantar → Gerenciar implantações → Editar → Nova versão**.
