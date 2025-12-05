// cloudinary.js - Configuração e utilitário para upload de arquivos.

const cloudinary = require('cloudinary').v2;
const { config } = require('./config');

// Configura o Cloudinary com as variáveis de ambiente
cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret,
    secure: true
});

/**
 * Faz o upload de um arquivo para o Cloudinary.
 * @param {string} filePath - Caminho local do arquivo a ser enviado.
 * @param {string} resourceType - Tipo de recurso ('image' ou 'video').
 * @param {string} folder - Pasta dentro do Cloudinary.
 * @returns {Promise<string>} URL segura do recurso.
 */
async function uploadFile(filePath, resourceType, folder) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: resourceType,
            folder: `cursos_online/${folder}`, // Ex: cursos_online/cursos ou cursos_online/videos
        });
        return result.secure_url;
    } catch (error) {
        console.error("Erro ao fazer upload para o Cloudinary:", error.message);
        throw new Error('Falha ao enviar arquivo para o armazenamento externo.');
    }
}

// Exporta a função de upload para ser usada pelos controllers
module.exports = {
    uploadFile
};
