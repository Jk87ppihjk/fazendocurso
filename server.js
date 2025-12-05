// server.js - Servidor principal com Express, CORS, e rotas.

const express = require('express');
const cors = require('cors');
const { config, logEnvironmentVariables } = require('./config');
const { initializeDatabase } = require('./database');
const { authMiddleware, adminGuard, registerUser, loginUser, loginAdmin } = require('./authController');
const { uploadCourseImage, uploadVideo, createCourse, createModule, createLesson } = require('./adminController');
const { getPublicCourses, getPublicCourseDetail, purchaseCourse, getPurchasedCourses, getCourseContent, requestRefund } = require('./userController');

const app = express();
const PORT = config.port;

// ===================================
// Inicialização do Servidor
// ===================================

async function startServer() {
    try {
        // 1. Log das Variáveis de Ambiente
        logEnvironmentVariables();

        // 2. Inicialização do Banco de Dados (Criação de Tabelas e Admin)
        await initializeDatabase();

        // 3. Middlewares Globais
        // CORS LIBERADO PARA TODOS OS DOMÍNIOS, conforme solicitado
        app.use(cors({
            origin: '*', // Permite todas as origens
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        }));
        
        app.use(express.json()); // Permite o parsing de JSON no corpo da requisição

        // ===================================
        // Rotas de Autenticação
        // ===================================

        // Admin
        app.post('/auth/admin/login', loginAdmin);
        
        // Usuário (Cliente)
        app.post('/auth/register', registerUser);
        app.post('/auth/login', loginUser);

        // ===================================
        // Rotas Públicas (Visualização de Cursos)
        // ===================================

        app.get('/courses', getPublicCourses); // Lista todos os cursos
        app.get('/courses/:courseId', getPublicCourseDetail); // Detalhe de um curso

        // ===================================
        // Rotas de Usuário (Requer Login)
        // ===================================
        
        // Aplica o middleware de autenticação em todas as rotas de usuário
        app.post('/user/purchase', authMiddleware, purchaseCourse); // Simula a compra
        app.get('/user/dashboard', authMiddleware, getPurchasedCourses); // Painel de cursos comprados
        app.get('/user/course/:courseId/content', authMiddleware, getCourseContent); // Conteúdo do curso (com Drip Content)
        app.post('/user/refund', authMiddleware, requestRefund); // Solicitação de reembolso (7 dias)

        // ===================================
        // Rotas do Admin (Requer Login + Guard)
        // ===================================
        
        // Criação de Curso (Requer upload de imagem)
        app.post('/admin/course', authMiddleware, adminGuard, uploadCourseImage, createCourse);
        
        // Criação de Módulo
        app.post('/admin/module', authMiddleware, adminGuard, createModule);
        
        // Criação de Aula (Requer upload de vídeo opcional)
        app.post('/admin/lesson', authMiddleware, adminGuard, uploadVideo, createLesson);

        // Rota de teste
        app.get('/', (req, res) => {
            res.json({ message: 'Backend de Cursos Online rodando! Acesse /courses para ver os cursos públicos.' });
        });


        // 4. Inicia o Servidor
        app.listen(PORT, () => {
            console.log(`\n🚀 Servidor Express rodando na porta ${PORT} (http://localhost:${PORT})`);
        });

    } catch (error) {
        console.error("❌ Falha na inicialização do backend:", error.message);
        process.exit(1); // Encerra o processo em caso de falha crítica
    }
}

startServer();
