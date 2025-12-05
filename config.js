// config.js - Gerencia as variáveis de ambiente e faz o log de inicialização.

const dotenv = require('dotenv');
dotenv.config();

// Mapeamento das variáveis de ambiente
const config = {
    // Variáveis do Banco de Dados (MySQL)
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    },
    // Variáveis do Cloudinary (Armazenamento de Vídeos/Imagens)
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
    // Chave Secreta JWT
    jwtSecret: process.env.JWT_SECRET,
    // Porta do Servidor
    port: process.env.PORT || 3000,
    // Configurações do Brevo (Email) - Assumindo que a chave API será lida separadamente na aplicação,
    // ou adicionada aqui se houver uma variável dedicada (Ex: BREVO_API_KEY).
    // Por enquanto, faremos o setup do Brevo no arquivo dedicado.
};

/**
 * Loga as variáveis de ambiente para confirmar a inicialização.
 */
function logEnvironmentVariables() {
    console.log("--- Variáveis de Ambiente Carregadas (Node.js Backend) ---");
    console.log("Variáveis de Ambiente configuradas e prontas para uso:");

    // Log para as variáveis CLOUDINARY
    console.log(`CLOUDINARY_CLOUD_NAME: ${config.cloudinary.cloud_name ? '✅ INICIADO' : '❌ AUSENTE'}`);
    console.log(`CLOUDINARY_API_KEY: ${config.cloudinary.api_key ? '✅ INICIADO' : '❌ AUSENTE'}`);
    console.log(`CLOUDINARY_API_SECRET: ${config.cloudinary.api_secret ? '✅ INICIADO' : '❌ AUSENTE'}`);

    // Log para as variáveis DB
    console.log(`DB_HOST: ${config.db.host ? '✅ INICIADO' : '❌ AUSENTE'}`);
    console.log(`DB_NAME: ${config.db.database ? '✅ INICIADO' : '❌ AUSENTE'}`);
    console.log(`DB_PASSWORD: ${config.db.password ? '✅ INICIADO' : '❌ AUSENTE'}`);
    console.log(`DB_USER: ${config.db.user ? '✅ INICIADO' : '❌ AUSENTE'}`);

    // Log para as variáveis JWT e PORT
    console.log(`JWT_SECRET: ${config.jwtSecret ? '✅ INICIADO' : '❌ AUSENTE'}`);
    console.log(`PORT: ${config.port ? '✅ INICIADO' : '❌ AUSENTE'}`);

    console.log("---------------------------------------------------------");
    console.log("Configurações iniciadas corretamente. Prosseguindo com o deploy.");
}

module.exports = {
    config,
    logEnvironmentVariables
};
