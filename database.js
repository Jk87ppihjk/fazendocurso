// database.js - Configuração da conexão MySQL e inicialização do Schema.

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { config } = require('./config');

const dbConfig = config.db;

// Conexão com o banco de dados
const pool = mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/**
 * Cria todas as tabelas e o usuário administrador inicial.
 */
async function initializeDatabase() {
    try {
        console.log("Iniciando a criação do Schema e usuário Admin...");

        // 1. Tabela de Administradores
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS Admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL
            );
        `);

        // 2. Tabela de Usuários (Clientes)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS Users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Tabela de Cursos
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS Courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                image_url VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Tabela de Módulos (Associados a um Curso)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS Modules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                order_index INT NOT NULL,
                FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
            );
        `);

        // 5. Tabela de Aulas (Associadas a um Módulo)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS Lessons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                module_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                video_url VARCHAR(255) NOT NULL,
                description_text TEXT,
                links JSON, -- Links em formato JSON
                drip_days INT NOT NULL DEFAULT 0, -- Drip content: dias após a compra para liberar o vídeo
                order_index INT NOT NULL,
                FOREIGN KEY (module_id) REFERENCES Modules(id) ON DELETE CASCADE
            );
        `);

        // 6. Tabela de Compras (Usuário compra Curso)
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS Purchases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id INT NOT NULL,
                purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY user_course_unique (user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
            );
        `);

        // 7. Tabela de Pedidos de Reembolso
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS RefundRequests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id INT NOT NULL,
                message TEXT NOT NULL,
                request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('PENDENTE', 'APROVADO', 'REJEITADO') DEFAULT 'PENDENTE',
                FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
            );
        `);

        console.log("Schema do Banco de Dados criado/verificado com sucesso.");

        // Verificar e criar o usuário Admin inicial (adm123/adm123)
        const [adminRows] = await pool.execute('SELECT id FROM Admins WHERE username = ?', ['adm123']);
        if (adminRows.length === 0) {
            const hashedPassword = await bcrypt.hash('adm123', 10);
            await pool.execute(
                'INSERT INTO Admins (username, password_hash) VALUES (?, ?)',
                ['adm123', hashedPassword]
            );
            console.log("Usuário Admin inicial (adm123/adm123) criado com sucesso.");
        } else {
            console.log("Usuário Admin inicial já existe.");
        }

        console.log("Banco de dados pronto para uso.");
    } catch (error) {
        console.error("ERRO FATAL ao inicializar o banco de dados:", error.message);
        throw error;
    }
}

// Exporta o pool para ser usado em todas as operações de DB
module.exports = {
    pool,
    initializeDatabase
};
