// brevo.js - Serviço de envio de emails (usando Brevo API).

// NOTA: A biblioteca oficial do Brevo é 'sib-api-v3-sdk'.
// Como não foi fornecida uma variável de ambiente para a API Key do Brevo,
// estou assumindo que ela será configurada ou lida diretamente no ambiente de deploy
// (ou que você a adicionará em um .env). Para este exemplo, vou simular o uso.

// IMPORTANTE: Para usar Brevo, você precisará de uma API Key.
// Por favor, defina a variável de ambiente: BREVO_API_KEY=sua_chave_aqui

const SibApiV3Sdk = require('sib-api-v3-sdk');

// Tenta configurar o cliente Brevo. Se a chave não estiver no ENV, ele logará um aviso.
let apiInstance = null;
const BREVO_API_KEY = process.env.BREVO_API_KEY; // Adicione esta chave ao seu .env

if (BREVO_API_KEY) {
    try {
        const defaultClient = SibApiV3Sdk.ApiClient.instance;
        const apiKey = defaultClient.authentications['api-key'];
        apiKey.apiKey = BREVO_API_KEY;
        apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        console.log("Serviço Brevo (Email) configurado com sucesso.");
    } catch (e) {
        console.error("Erro ao configurar o cliente Brevo:", e.message);
    }
} else {
    console.warn("AVISO: Variável de ambiente BREVO_API_KEY ausente. O envio de emails (reembolsos) será desabilitado.");
}


/**
 * Envia um email de notificação de reembolso para o Admin.
 * @param {string} userName - Nome do usuário solicitando.
 * @param {string} userEmail - Email do usuário.
 * @param {string} courseName - Nome do curso.
 * @param {string} message - Mensagem do usuário.
 */
async function sendRefundNotification(userName, userEmail, courseName, message) {
    if (!apiInstance) {
        console.error("Falha no envio de email: Cliente Brevo não configurado (API Key ausente).");
        return;
    }

    // O email de destino do Admin deve ser configurado aqui.
    const ADMIN_EMAIL = 'admin@seusite.com'; // ALtere para o email real do Admin

    try {
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.subject = `🚨 NOVO PEDIDO DE REEMBOLSO: ${courseName}`;
        sendSmtpEmail.htmlContent = `
            <html>
                <body>
                    <h1>Novo Pedido de Reembolso Recebido</h1>
                    <p><strong>Usuário:</strong> ${userName} (${userEmail})</p>
                    <p><strong>Curso:</strong> ${courseName}</p>
                    <p><strong>Mensagem do Usuário:</strong></p>
                    <p style="border: 1px solid #ccc; padding: 10px;">${message}</p>
                    <p>Acesse o painel de administração para processar o pedido.</p>
                </body>
            </html>
        `;
        sendSmtpEmail.sender = { 'name': 'Sistema de Cursos', 'email': 'noreply@seusite.com' };
        sendSmtpEmail.to = [{ 'email': ADMIN_EMAIL, 'name': 'Administrador' }];
        sendSmtpEmail.replyTo = { 'email': userEmail, 'name': userName };

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`Email de notificação de reembolso enviado para o Admin em ${ADMIN_EMAIL}.`);

    } catch (error) {
        console.error("Erro ao enviar email de notificação via Brevo:", error.message);
        throw new Error('Falha no serviço de envio de email.');
    }
}

module.exports = {
    sendRefundNotification
};
