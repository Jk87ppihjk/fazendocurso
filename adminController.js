// adminController.js - Lógica CRUD para Cursos, Módulos e Aulas.

const { pool } = require('./database');
const { uploadFile } = require('./cloudinary');
const multer = require('multer');

// Configuração do Multer para upload em memória (necessário para o Cloudinary)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // Limite de 10GB para vídeos
});

// Middleware de upload para imagens PNG
const uploadCourseImage = upload.single('image');
// Middleware de upload para vídeos
const uploadVideo = upload.single('video');

// ===================================
// Lógica de Cursos
// ===================================

/**
 * Cria um novo Curso (com upload de imagem).
 */
async function createCourse(req, res) {
    // req.file é preenchido pelo multer (uploadCourseImage)
    const { name, description, price } = req.body;
    
    if (!name || !description || !price || !req.file) {
        return res.status(400).json({ message: 'Nome, descrição, preço e imagem (PNG) são obrigatórios.' });
    }

    // Validação básica do tipo de imagem (PNG)
    if (req.file.mimetype !== 'image/png') {
        return res.status(400).json({ message: 'O arquivo da imagem da capa deve ser PNG.' });
    }

    try {
        // O Multer salva o buffer na memória (req.file.buffer).
        // Criamos um caminho temporário ou usamos a funcionalidade do Cloudinary.
        // O Cloudinary permite upload via Buffer se a biblioteca for importada,
        // mas é mais seguro usar o caminho temporário se o buffer for muito grande.
        // Para simplificar no ambiente Canvas, usaremos um truque com base64 se necessário,
        // mas aqui vamos tratar como um upload simples de imagem.

        // Em ambientes de produção Node.js, você faria:
        // 1. Salvar o buffer em um arquivo temporário (`fs.writeFileSync`).
        // 2. Usar o caminho do arquivo temporário no `uploadFile`.
        // 3. Deletar o arquivo temporário.

        // Para simular o upload para o Cloudinary de forma simples no contexto de um artefato:
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const imageUrl = await uploadFile(base64Image, 'image', 'cursos_capas');

        const [result] = await pool.execute(
            'INSERT INTO Courses (name, description, price, image_url) VALUES (?, ?, ?, ?)',
            [name, description, parseFloat(price), imageUrl]
        );

        res.status(201).json({ 
            message: 'Curso criado com sucesso!', 
            courseId: result.insertId,
            imageUrl: imageUrl
        });

    } catch (error) {
        console.error('Erro ao criar curso e fazer upload:', error.message);
        res.status(500).json({ message: 'Erro interno ao criar curso.' });
    }
}

// ===================================
// Lógica de Módulos
// ===================================

/**
 * Cria um novo Módulo para um Curso existente.
 */
async function createModule(req, res) {
    const { courseId, name, orderIndex } = req.body;

    if (!courseId || !name || orderIndex === undefined) {
        return res.status(400).json({ message: 'ID do curso, nome do módulo e índice de ordem são obrigatórios.' });
    }

    try {
        // Verifica se o curso existe
        const [course] = await pool.execute('SELECT id FROM Courses WHERE id = ?', [courseId]);
        if (course.length === 0) {
            return res.status(404).json({ message: 'Curso não encontrado.' });
        }

        const [result] = await pool.execute(
            'INSERT INTO Modules (course_id, name, order_index) VALUES (?, ?, ?)',
            [courseId, name, parseInt(orderIndex)]
        );

        res.status(201).json({ 
            message: 'Módulo criado com sucesso!', 
            moduleId: result.insertId 
        });

    } catch (error) {
        console.error('Erro ao criar módulo:', error);
        res.status(500).json({ message: 'Erro interno ao criar módulo.' });
    }
}

// ===================================
// Lógica de Aulas
// ===================================

/**
 * Cria uma nova Aula com upload de vídeo (opcional) e links/descrição.
 */
async function createLesson(req, res) {
    // req.file é preenchido pelo multer (uploadVideo) - Se houver vídeo.
    const { moduleId, title, descriptionText, linksJson, dripDays, orderIndex } = req.body;

    if (!moduleId || !title || dripDays === undefined || orderIndex === undefined) {
        return res.status(400).json({ message: 'Módulo ID, título, dias de liberação (drip days) e índice de ordem são obrigatórios.' });
    }

    let videoUrl = '';
    
    // 1. Upload de Vídeo, se existir
    if (req.file) {
        // Validação básica de tipo de arquivo (assumindo vídeo)
        if (!req.file.mimetype.startsWith('video/')) {
            return res.status(400).json({ message: 'O arquivo enviado deve ser um vídeo.' });
        }
        
        try {
            // Em produção, use o caminho local temporário. Aqui, simulamos o upload.
            const base64Video = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            videoUrl = await uploadFile(base64Video, 'video', 'aulas_videos');
        } catch (uploadError) {
            return res.status(500).json({ message: 'Falha ao enviar vídeo para o Cloudinary.' });
        }
    } else {
        // Se não houver upload, o campo de vídeo será vazio ou deve ser preenchido
        // com um link externo, se for o caso. Aqui, assumimos que o upload é a fonte principal.
        // Se for apenas link de texto, videoUrl fica vazia, mas a aula é criada.
        console.log("Nenhum arquivo de vídeo foi enviado, criando aula apenas com metadados.");
    }
    
    // 2. Formatação dos links
    let links = null;
    try {
        links = linksJson ? JSON.stringify(JSON.parse(linksJson)) : null;
    } catch (e) {
        return res.status(400).json({ message: 'Os links devem estar em formato JSON válido.' });
    }

    try {
        const [result] = await pool.execute(
            `INSERT INTO Lessons (module_id, title, video_url, description_text, links, drip_days, order_index) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                moduleId, 
                title, 
                videoUrl, 
                descriptionText || null, 
                links, 
                parseInt(dripDays), 
                parseInt(orderIndex)
            ]
        );

        res.status(201).json({ 
            message: 'Aula criada com sucesso!', 
            lessonId: result.insertId,
            videoUrl: videoUrl 
        });

    } catch (error) {
        console.error('Erro ao criar aula:', error);
        res.status(500).json({ message: 'Erro interno ao criar aula.' });
    }
}

module.exports = {
    uploadCourseImage,
    uploadVideo,
    createCourse,
    createModule,
    createLesson
};
