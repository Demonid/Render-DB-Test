const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

// Configuración de la base de datos desde variables de entorno (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Crear tabla si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('Error creando tabla:', err));

// === API REST ===

// Obtener todos
app.get('/api/todos', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, text FROM todos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar todo
app.post('/api/todos', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });

  try {
    const result = await pool.query(
      'INSERT INTO todos (text) VALUES ($1) RETURNING id, text',
      [text.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar todo
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir frontend (HTML embebido)
app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Todo List - Render + PostgreSQL</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
    input { padding: 8px; width: 70%; font-size: 16px; }
    button { padding: 8px 12px; font-size: 16px; }
    ul { list-style: none; padding: 0; }
    li { padding: 8px; background: #f0f0f0; margin: 5px 0; display: flex; justify-content: space-between; }
    .delete { background: #e74c3c; color: white; border: none; padding: 4px 8px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Todo List</h1>
  <div>
    <input type="text" id="todoInput" placeholder="Nueva tarea..." />
    <button onclick="addTodo()">Agregar</button>
  </div>
  <ul id="todoList"></ul>

  <script>
    const api = '/api/todos';

    async function loadTodos() {
      const res = await fetch(api);
      const todos = await res.json();
      const list = document.getElementById('todoList');
      list.innerHTML = '';
      todos.forEach(todo => {
        const li = document.createElement('li');
        li.innerHTML = \`\${todo.text} <button class="delete" onclick="deleteTodo(\${todo.id})">×</button>\`;
        list.appendChild(li);
      });
    }

    async function addTodo() {
      const input = document.getElementById('todoInput');
      const text = input.value.trim();
      if (!text) return;
      await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      input.value = '';
      loadTodos();
    }

    async function deleteTodo(id) {
      await fetch(\`\${api}/\${id}\`, { method: 'DELETE' });
      loadTodos();
    }

    // Cargar al inicio
    loadTodos();

    // Permitir Enter para agregar
    document.getElementById('todoInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') addTodo();
    });
  </script>
</body>
</html>
  `);
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});