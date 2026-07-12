/**
 * ============================================================
 *  BACKEND — Sistema de Dados (Google Apps Script)
 *  Integra um site estático com Google Sheets + Google Drive.
 *
 *  - doPost: recebe um cadastro do formulário, grava uma linha
 *    na planilha e (se houver anexo) salva o arquivo na pasta
 *    do Drive, devolvendo o link.
 *  - doGet:  lê os registros da planilha e a lista de arquivos
 *    da pasta do Drive e devolve em JSON para o painel.
 *
 *  Leia backend/INSTRUCOES.md para publicar este script.
 * ============================================================
 */

// ---------- CONFIGURAÇÃO (preencha estes 3 valores) ----------
// 1) ID da planilha Google (está na URL da planilha, entre /d/ e /edit)
var PLANILHA_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
// 2) ID da pasta do Drive onde os anexos serão salvos (na URL da pasta, depois de /folders/)
var PASTA_DRIVE_ID = 'COLE_AQUI_O_ID_DA_PASTA';
// 3) Token de segurança — invente uma senha e use a MESMA em sistema/config.js
var API_TOKEN = 'TROQUE_POR_UMA_SENHA_FORTE';

// Nome da aba (página) da planilha usada para os registros
var ABA = 'Registros';

// Cabeçalho das colunas (a ordem é importante)
var CABECALHO = ['DataHora', 'Data', 'Tipo', 'Categoria', 'Descricao', 'Cliente', 'Documento', 'NumeroDoc', 'FormaPagamento', 'Valor', 'Status', 'Vencimento', 'Observacao', 'LinkArquivo'];

// ============================================================
//  ENTRADA DE DADOS (formulário -> planilha + Drive)
// ============================================================
function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);

    if (dados.token !== API_TOKEN) {
      return resposta({ ok: false, erro: 'Token inválido' });
    }

    var aba = obterAba();

    // Anexo opcional enviado como base64
    var linkArquivo = '';
    if (dados.arquivoBase64 && dados.arquivoNome) {
      linkArquivo = salvarArquivo(dados.arquivoBase64, dados.arquivoNome, dados.arquivoTipo);
    }

    var valor = parseFloat(dados.valor);
    if (isNaN(valor)) valor = 0;

    aba.appendRow([
      new Date(),
      String(dados.data || ''),
      String(dados.tipo || ''),
      String(dados.categoria || ''),
      String(dados.descricao || ''),
      String(dados.cliente || ''),
      String(dados.documento || ''),
      String(dados.numeroDoc || ''),
      String(dados.formaPagamento || ''),
      valor,
      String(dados.status || ''),
      String(dados.vencimento || ''),
      String(dados.observacao || ''),
      linkArquivo
    ]);

    return resposta({ ok: true, linkArquivo: linkArquivo });
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  }
}

// ============================================================
//  LEITURA DE DADOS (planilha + Drive -> painel)
// ============================================================
function doGet(e) {
  try {
    var token = e && e.parameter ? e.parameter.token : '';
    if (token !== API_TOKEN) {
      return resposta({ ok: false, erro: 'Token inválido' });
    }

    var aba = obterAba();
    var valores = aba.getDataRange().getValues();
    valores.shift(); // remove o cabeçalho

    var registros = valores.map(function (linha) {
      return {
        dataHora: linha[0] ? new Date(linha[0]).toISOString() : '',
        data: soData(linha[1]),
        tipo: linha[2],
        categoria: linha[3],
        descricao: linha[4],
        cliente: linha[5],
        documento: linha[6],
        numeroDoc: linha[7],
        formaPagamento: linha[8],
        valor: Number(linha[9]) || 0,
        status: linha[10],
        vencimento: soData(linha[11]),
        observacao: linha[12],
        linkArquivo: linha[13]
      };
    }).filter(function (r) { return r.descricao || r.tipo || r.valor; });

    return resposta({ ok: true, registros: registros, arquivos: listarArquivos() });
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  }
}

// ============================================================
//  FUNÇÕES AUXILIARES
// ============================================================
function obterAba() {
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = planilha.getSheetByName(ABA);
  if (!aba) {
    aba = planilha.insertSheet(ABA);
  }
  // Garante o cabeçalho na primeira linha
  if (aba.getLastRow() === 0) {
    aba.appendRow(CABECALHO);
    aba.getRange(1, 1, 1, CABECALHO.length).setFontWeight('bold');
  }
  return aba;
}

function salvarArquivo(base64, nome, tipo) {
  var conteudo = base64.indexOf(',') >= 0 ? base64.split(',')[1] : base64;
  var bytes = Utilities.base64Decode(conteudo);
  var blob = Utilities.newBlob(bytes, tipo || 'application/octet-stream', nome);
  var pasta = DriveApp.getFolderById(PASTA_DRIVE_ID);
  var arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return arquivo.getUrl();
}

function listarArquivos() {
  var lista = [];
  var pasta = DriveApp.getFolderById(PASTA_DRIVE_ID);
  var it = pasta.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    lista.push({ nome: f.getName(), link: f.getUrl(), criadoEm: f.getDateCreated().toISOString() });
  }
  return lista;
}

// Normaliza um valor de data (texto "AAAA-MM-DD" ou objeto Date) para "AAAA-MM-DD"
function soData(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).slice(0, 10);
}

function resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
