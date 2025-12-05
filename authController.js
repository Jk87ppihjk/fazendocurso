// authController.js - Gerencia o login, cadastro e autenticação via JWT.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('./database');
const { config } = require('./config');

const jwtSecret = config.jwtSecret;

/**
 * Middleware para verificar o token JWT e autenticar o usuário ou admin.
 * Define req.userId e req.userType ('admin' ou 'user').
 */
async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Espera "Bearer <token>"

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.id;
        req.userType = decoded.type; // 'admin' ou 'user'
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
}

// ===================================
// Lógica de Autenticação de Usuário
// ===================================

/**
 * Rota de Cadastro de Novo Usuário (Cliente).
 */
async function registerUser(req, res) {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios.' });
    }

    try {
        const [existingUser] = await pool.execute('SELECT id FROM Users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: 'Este email já está cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO Users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword]);

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ message: 'Erro interno no servidor ao tentar cadastrar.' });
    }
}

/**
 * Rota de Login de Usuário (Cliente).
 */
async function loginUser(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    try {
        const [rows] = await pool.execute('SELECT id, password_hash, name FROM Users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }

        // Gera token JWT com tipo 'user'
        const token = jwt.sign({ id: user.id, type: 'user' }, jwtSecret, { expiresIn: '7d' });

        res.json({ token, user: { id: user.id, name: user.name, email }, type: 'user' });

    } catch (error) {
        console.error('Erro ao logar usuário:', error);
        res.status(500).json({ message: 'Erro interno no servidor ao tentar logar.' });
    }
}


// ===================================
// Lógica de Autenticação de Admin
// ===================================

/**
 * Middleware para garantir que apenas o Admin acesse a rota.
 */
function adminGuard(req, res, next) {
    if (req.userType !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem acessar esta rota.' });
    }
    next();
}

/**
 * Rota de Login de Administrador.
 */
async function loginAdmin(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    try {
        const [rows] = await pool.execute('SELECT id, password_hash FROM Admins WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
        }

        const admin = rows[0];
        const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
        }

        // Gera token JWT com tipo 'admin'
        const token = jwt.sign({ id: admin.id, type: 'admin' }, jwtSecret, { expiresIn: '1d' });

        res.json({ token, admin: { id: admin.id, username }, type: 'admin' });

    } catch (error) {
        console.error('Erro ao logar admin:', error);
        res.status(500).json({ message: 'Erro interno no servidor ao tentar logar o administrador.' });
    }
}

module.exports = {
    authMiddleware,
    adminGuard,
    registerUser,
    loginUser,
    loginAdmin
};
