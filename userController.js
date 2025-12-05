// userController.js - Lógica para visualização de cursos, compras e reembolso.

const { pool } = require('./database');
const { sendRefundNotification } = require('./brevo');

// ===================================
// Rotas Públicas (Sem Login)
// ===================================

/**
 * Lista todos os cursos publicamente (apenas capa, nome, descrição e preço).
 */
async function getPublicCourses(req, res) {
    try {
        const [courses] = await pool.execute(
            'SELECT id, name, image_url, description, price FROM Courses ORDER BY id DESC'
        );
        res.json(courses);
    } catch (error) {
        console.error('Erro ao buscar cursos públicos:', error);
        res.status(500).json({ message: 'Erro interno ao buscar cursos.' });
    }
}

/**
 * Detalhe de um curso publicamente.
 */
async function getPublicCourseDetail(req, res) {
    const { courseId } = req.params;
    try {
        const [courses] = await pool.execute(
            'SELECT id, name, image_url, description, price FROM Courses WHERE id = ?', 
            [courseId]
        );
        if (courses.length === 0) {
            return res.status(404).json({ message: 'Curso não encontrado.' });
        }

        // Retorna apenas a informação pública
        res.json(courses[0]);

    } catch (error) {
        console.error('Erro ao buscar detalhe do curso:', error);
        res.status(500).json({ message: 'Erro interno ao buscar detalhe do curso.' });
    }
}


// ===================================
// Rotas de Usuário (Logado)
// ===================================

/**
 * Simula a compra de um curso (atrelada ao email do usuário).
 * (Em um ambiente real, aqui estaria a integração com um gateway de pagamento).
 */
async function purchaseCourse(req, res) {
    // Requer autenticação (authMiddleware)
    const userId = req.userId;
    const { courseId } = req.body;

    if (!courseId) {
        return res.status(400).json({ message: 'O ID do curso é obrigatório.' });
    }

    try {
        // Verifica se o curso existe
        const [course] = await pool.execute('SELECT id, name FROM Courses WHERE id = ?', [courseId]);
        if (course.length === 0) {
            return res.status(404).json({ message: 'Curso não encontrado.' });
        }
        
        // Tenta inserir a compra (UNIQUE KEY evita compras duplicadas)
        const [result] = await pool.execute(
            'INSERT INTO Purchases (user_id, course_id) VALUES (?, ?)',
            [userId, courseId]
        );

        res.status(201).json({ message: `Compra do curso '${course[0].name}' registrada com sucesso!`, purchaseId: result.insertId });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Você já comprou este curso.' });
        }
        console.error('Erro ao registrar compra:', error);
        res.status(500).json({ message: 'Erro interno ao registrar compra.' });
    }
}

/**
 * Painel do Usuário: Lista os cursos comprados.
 */
async function getPurchasedCourses(req, res) {
    const userId = req.userId;

    try {
        const [purchases] = await pool.execute(
            `SELECT p.course_id, c.name, c.image_url, c.description, p.purchase_date
             FROM Purchases p
             JOIN Courses c ON p.course_id = c.id
             WHERE p.user_id = ?
             ORDER BY p.purchase_date DESC`,
            [userId]
        );
        
        // Adiciona a flag de elegibilidade ao reembolso (7 dias após a compra)
        const coursesWithRefundStatus = purchases.map(course => {
            const purchaseDate = new Date(course.purchase_date);
            const now = new Date();
            const diffTime = Math.abs(now - purchaseDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const isRefundEligible = diffDays <= 7;
            
            return {
                ...course,
                isRefundEligible,
                daysSincePurchase: diffDays
            };
        });

        res.json(coursesWithRefundStatus);

    } catch (error) {
        console.error('Erro ao buscar cursos comprados:', error);
        res.status(500).json({ message: 'Erro interno ao buscar cursos comprados.' });
    }
}


/**
 * Obtém os detalhes de um curso comprado, incluindo módulos e aulas, 
 * aplicando a lógica de Drip Content.
 */
async function getCourseContent(req, res) {
    const userId = req.userId;
    const { courseId } = req.params;

    try {
        // 1. Verificar se o usuário comprou o curso
        const [purchase] = await pool.execute(
            'SELECT purchase_date FROM Purchases WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (purchase.length === 0) {
            return res.status(403).json({ message: 'Acesso negado. Você precisa comprar este curso para ver o conteúdo.' });
        }

        const purchaseDate = new Date(purchase[0].purchase_date);
        
        // 2. Buscar o curso e seus módulos
        const [courseInfo] = await pool.execute('SELECT id, name FROM Courses WHERE id = ?', [courseId]);
        if (courseInfo.length === 0) return res.status(404).json({ message: 'Curso não encontrado.' });

        const [modules] = await pool.execute(
            'SELECT id, name, order_index FROM Modules WHERE course_id = ? ORDER BY order_index ASC',
            [courseId]
        );

        // 3. Buscar as aulas e aplicar a lógica de Drip Content
        for (let module of modules) {
            const [lessons] = await pool.execute(
                `SELECT id, title, video_url, description_text, links, drip_days, order_index 
                 FROM Lessons 
                 WHERE module_id = ? 
                 ORDER BY order_index ASC`,
                [module.id]
            );

            module.lessons = lessons.map(lesson => {
                const dripDays = lesson.drip_days;
                
                // Calcula a data de liberação (Data da Compra + Drip Days)
                const releaseDate = new Date(purchaseDate);
                releaseDate.setDate(purchaseDate.getDate() + dripDays);
                
                const now = new Date();
                const isReleased = now >= releaseDate;
                
                // Se não estiver liberado, oculta os dados sensíveis (URL do vídeo, descrição, links)
                if (!isReleased) {
                    return {
                        id: lesson.id,
                        title: lesson.title,
                        order_index: lesson.order_index,
                        isReleased: false,
                        releaseDate: releaseDate.toISOString().split('T')[0], // Data de liberação para o usuário
                        videoUrl: null, // Ocultado
                        descriptionText: 'O conteúdo desta aula será liberado em breve.',
                        links: null, // Ocultado
                    };
                }

                // Se estiver liberado, retorna o conteúdo completo
                return {
                    ...lesson,
                    isReleased: true,
                    links: lesson.links ? JSON.parse(lesson.links) : null // Parseia o JSON dos links
                };
            });
        }
        
        res.json({
            course: courseInfo[0],
            modules
        });

    } catch (error) {
        console.error('Erro ao buscar conteúdo do curso:', error);
        res.status(500).json({ message: 'Erro interno ao buscar conteúdo do curso.' });
    }
}


/**
 * Solicita o reembolso de um curso (apenas nos primeiros 7 dias após a compra).
 */
async function requestRefund(req, res) {
    const userId = req.userId;
    const { courseId, message } = req.body;

    if (!courseId || !message) {
        return res.status(400).json({ message: 'ID do curso e a mensagem de solicitação são obrigatórios.' });
    }

    try {
        // 1. Verifica se o curso foi comprado e se está no prazo de 7 dias
        const [purchaseRows] = await pool.execute(
            'SELECT c.name, u.name as user_name, u.email, p.purchase_date FROM Purchases p JOIN Courses c ON p.course_id = c.id JOIN Users u ON p.user_id = u.id WHERE p.user_id = ? AND p.course_id = ?',
            [userId, courseId]
        );

        if (purchaseRows.length === 0) {
            return res.status(404).json({ message: 'Compra não encontrada para este curso.' });
        }
        
        const purchase = purchaseRows[0];
        const purchaseDate = new Date(purchase.purchase_date);
        const now = new Date();
        const diffTime = Math.abs(now - purchaseDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 7) {
            return res.status(403).json({ message: `O prazo de 7 dias para reembolso expirou. Você comprou há ${diffDays} dias.` });
        }
        
        // 2. Verifica se o reembolso já foi solicitado
        const [requestRows] = await pool.execute(
            'SELECT id FROM RefundRequests WHERE user_id = ? AND course_id = ? AND status = ?',
            [userId, courseId, 'PENDENTE']
        );

        if (requestRows.length > 0) {
            return res.status(409).json({ message: 'Você já possui um pedido de reembolso pendente para este curso.' });
        }

        // 3. Registra o pedido de reembolso no DB
        await pool.execute(
            'INSERT INTO RefundRequests (user_id, course_id, message) VALUES (?, ?, ?)',
            [userId, courseId, message]
        );

        // 4. Notifica o Admin por email (via Brevo)
        await sendRefundNotification(purchase.user_name, purchase.email, purchase.name, message);

        res.json({ message: 'Pedido de reembolso enviado com sucesso! O administrador será notificado.' });

    } catch (error) {
        console.error('Erro ao solicitar reembolso:', error.message);
        res.status(500).json({ message: 'Erro interno ao processar pedido de reembolso.' });
    }
}

module.exports = {
    getPublicCourses,
    getPublicCourseDetail,
    purchaseCourse,
    getPurchasedCourses,
    getCourseContent,
    requestRefund
};
