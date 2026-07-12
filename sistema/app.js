'use strict'

/* ============================================================
   Frontend do Sistema de Dados
   - cadastro.html: envia dados ao backend (ou simula em demo)
   - painel.html:   lê dados do backend e monta o dashboard
   ============================================================ */

const EM_DEMO = !CONFIG.WEB_APP_URL

// Formatação de moeda em Real
const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
})

const formatarData = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// Formata uma data AAAA-MM-DD para DD/MM/AAAA (sem fuso/hora)
const formatarDia = (ymd) => {
    if (!ymd) return ''
    const partes = String(ymd).slice(0, 10).split('-')
    return partes.length === 3 ? partes.reverse().join('/') : String(ymd)
}

// Lê um arquivo do <input type="file"> como base64
const lerArquivo = (file) => new Promise((resolve, reject) => {
    if (!file) return resolve(null)
    const reader = new FileReader()
    reader.onload = () => resolve({
        nome: file.name,
        tipo: file.type,
        base64: reader.result
    })
    reader.onerror = reject
    reader.readAsDataURL(file)
})

// Apenas a parte da data (AAAA-MM-DD) de N dias atrás
const diasAtras = (n) => new Date(Date.now() - 864e5 * n).toISOString().slice(0, 10)

/* ---------- Dados de exemplo (modo demonstração) ---------- */
const DADOS_DEMO = [
    { dataHora: new Date(Date.now() - 864e5 * 5).toISOString(), data: diasAtras(5), tipo: 'Entrada', categoria: 'Vendas', descricao: 'Venda de produtos', cliente: 'Ana Souza', documento: '123.456.789-00', numeroDoc: 'NF-1001', formaPagamento: 'Pix', valor: 1250.5, status: 'Pago', vencimento: '', observacao: 'Cliente recorrente', linkArquivo: '' },
    { dataHora: new Date(Date.now() - 864e5 * 4).toISOString(), data: diasAtras(4), tipo: 'Saída', categoria: 'Fornecedores', descricao: 'Compra de matéria-prima', cliente: 'Fornecedor XYZ Ltda', documento: '12.345.678/0001-99', numeroDoc: 'NF-2002', formaPagamento: 'Boleto', valor: 600, status: 'Pendente', vencimento: diasAtras(-3), observacao: '', linkArquivo: '' },
    { dataHora: new Date(Date.now() - 864e5 * 3).toISOString(), data: diasAtras(3), tipo: 'Entrada', categoria: 'Serviços', descricao: 'Pacote anual', cliente: 'Carla Dias', documento: '', numeroDoc: 'NF-1002', formaPagamento: 'Cartão', valor: 3400, status: 'Pago', vencimento: '', observacao: 'Contrato 12 meses', linkArquivo: '' },
    { dataHora: new Date(Date.now() - 864e5 * 2).toISOString(), data: diasAtras(2), tipo: 'Saída', categoria: 'Salários', descricao: 'Folha de pagamento', cliente: 'Equipe', documento: '', numeroDoc: '', formaPagamento: 'Transferência', valor: 4200, status: 'Pago', vencimento: '', observacao: '', linkArquivo: '' },
    { dataHora: new Date(Date.now() - 864e5 * 1).toISOString(), data: diasAtras(1), tipo: 'Entrada', categoria: 'Vendas', descricao: 'Venda balcão', cliente: 'Elaine Rocha', documento: '', numeroDoc: 'NF-1003', formaPagamento: 'Dinheiro', valor: 890.9, status: 'Pago', vencimento: '', observacao: 'Desconto aplicado', linkArquivo: '' }
]

/* ============================================================
   ENVIO DO FORMULÁRIO (cadastro.html)
   ============================================================ */
async function enviarCadastro(form) {
    const aviso = document.getElementById('aviso')
    const botao = form.querySelector('button[type="submit"]')
    const original = botao.textContent
    botao.disabled = true
    botao.textContent = 'Enviando...'

    try {
        const anexo = await lerArquivo(form.arquivo.files[0])
        const payload = {
            token: CONFIG.API_TOKEN,
            data: form.data.value,
            tipo: form.tipo.value,
            categoria: form.categoria.value,
            descricao: form.descricao.value.trim(),
            cliente: form.cliente.value.trim(),
            documento: form.documento.value.trim(),
            numeroDoc: form.numeroDoc.value.trim(),
            formaPagamento: form.formaPagamento.value,
            valor: form.valor.value,
            status: form.status.value,
            vencimento: form.vencimento.value,
            observacao: form.observacao.value.trim(),
            arquivoBase64: anexo ? anexo.base64 : '',
            arquivoNome: anexo ? anexo.nome : '',
            arquivoTipo: anexo ? anexo.tipo : ''
        }

        if (EM_DEMO) {
            mostrarAviso(aviso, 'ok', '✅ (Modo demonstração) Cadastro simulado com sucesso. Configure o backend para salvar de verdade.')
            form.reset()
            return
        }

        // Apps Script exige content-type "text/plain" para evitar preflight CORS
        const resp = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        const data = await resp.json()

        if (data.ok) {
            mostrarAviso(aviso, 'ok', '✅ Cadastro salvo no Google Drive/Sheets com sucesso!')
            form.reset()
        } else {
            mostrarAviso(aviso, 'erro', '❌ Erro ao salvar: ' + (data.erro || 'desconhecido'))
        }
    } catch (err) {
        mostrarAviso(aviso, 'erro', '❌ Falha de conexão: ' + err.message)
    } finally {
        botao.disabled = false
        botao.textContent = original
    }
}

function mostrarAviso(el, tipo, msg) {
    el.className = 'aviso ' + tipo
    el.textContent = msg
    el.hidden = false
}

/* ============================================================
   PAINEL / DASHBOARD (painel.html)
   ============================================================ */
async function carregarPainel() {
    const status = document.getElementById('status')
    let registros = []

    try {
        if (EM_DEMO) {
            registros = DADOS_DEMO
            status.textContent = 'Modo demonstração — dados de exemplo. Configure o backend para ver dados reais.'
            status.className = 'status demo'
        } else {
            const url = CONFIG.WEB_APP_URL + '?token=' + encodeURIComponent(CONFIG.API_TOKEN)
            const resp = await fetch(url)
            const data = await resp.json()
            if (!data.ok) throw new Error(data.erro || 'Resposta inválida')
            registros = data.registros || []
            status.textContent = 'Conectado ao Google Drive/Sheets — ' + registros.length + ' registro(s).'
            status.className = 'status ok'
        }
    } catch (err) {
        status.textContent = 'Falha ao carregar dados: ' + err.message
        status.className = 'status erro'
        return
    }

    renderResumo(registros)
    renderTabela(registros)
    renderGrafico(registros)
}

const ehEntrada = (r) => (r.tipo || '').toLowerCase() === 'entrada'
const ehSaida = (r) => (r.tipo || '').toLowerCase() === 'saída' || (r.tipo || '').toLowerCase() === 'saida'

function renderResumo(registros) {
    const total = registros.length
    const entradas = registros.filter(ehEntrada).reduce((s, r) => s + (Number(r.valor) || 0), 0)
    const saidas = registros.filter(ehSaida).reduce((s, r) => s + (Number(r.valor) || 0), 0)
    const saldo = entradas - saidas

    document.getElementById('totalRegistros').textContent = total
    document.getElementById('totalEntradas').textContent = moeda(entradas)
    document.getElementById('totalSaidas').textContent = moeda(saidas)
    document.getElementById('saldo').textContent = moeda(saldo)
}

function renderTabela(registros) {
    const tbody = document.getElementById('tabelaBody')
    const recentes = [...registros].reverse().slice(0, 50)
    tbody.innerHTML = recentes.map(r => `
        <tr>
            <td>${escapar(formatarDia(r.data) || formatarData(r.dataHora))}</td>
            <td><span class="tag">${escapar(r.tipo)}</span></td>
            <td>${escapar(r.categoria)}</td>
            <td>${escapar(r.descricao)}</td>
            <td>${escapar(r.cliente)}</td>
            <td>${escapar(r.formaPagamento)}</td>
            <td class="num">${moeda(r.valor)}</td>
            <td><span class="tag">${escapar(r.status)}</span></td>
            <td>${r.linkArquivo ? `<a href="${r.linkArquivo}" target="_blank" rel="noopener">abrir</a>` : '—'}</td>
        </tr>`).join('') || '<tr><td colspan="9" class="vazio">Nenhum registro ainda.</td></tr>'
}

function escapar(txt) {
    return String(txt == null ? '' : txt)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let grafico = null
function renderGrafico(registros) {
    // Agrupa entradas e saídas por dia
    const porDia = {}
    registros.forEach(r => {
        const dia = (r.data || r.dataHora || '').slice(0, 10)
        if (!dia) return
        if (!porDia[dia]) porDia[dia] = { entrada: 0, saida: 0 }
        const v = Number(r.valor) || 0
        if (ehSaida(r)) porDia[dia].saida += v
        else porDia[dia].entrada += v
    })
    const labels = Object.keys(porDia).sort()
    const entradas = labels.map(d => porDia[d].entrada)
    const saidas = labels.map(d => porDia[d].saida)
    const labelsFmt = labels.map(d => d.split('-').reverse().slice(0, 2).join('/'))

    const ctx = document.getElementById('grafico')
    if (!ctx || typeof Chart === 'undefined') return
    if (grafico) grafico.destroy()
    grafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelsFmt,
            datasets: [
                { label: 'Entradas (R$)', data: entradas, backgroundColor: '#5fae34', borderRadius: 6 },
                { label: 'Saídas (R$)', data: saidas, backgroundColor: '#d9534f', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: true } }
        }
    })
}
