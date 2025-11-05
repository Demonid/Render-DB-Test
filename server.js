const express = require('express');
const { Pool } = require('pg');
const app = express();

// Configuración de la base de datos (Render)
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

// 1. Consultar TODOS los registros
app.get('/api/todos', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, text FROM todos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Consultar UN registro individual
app.get('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT id, text FROM todos WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Agregar registro
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

// 4. Editar registro
app.put('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });

  try {
    const result = await pool.query(
      'UPDATE todos SET text = $1 WHERE id = $2 RETURNING id, text',
      [text.trim(), id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Eliminar registro
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Frontend embebido (interfaz gráfica) ===
app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Todo List - Actividad 3.3</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
    h1 { text-align: center; }
    input, button { padding: 8px; font-size: 16px; }
    input { width: 65%; }
    button { margin-left: 5px; }
    ul { list-style: none; padding: 0; }
    li { 
      padding: 10px; background: #f7f7f7; margin: 8px 0; 
      border-radius: 5px; display: flex; justify-content: space-between; align-items: center;
      word-break: break-word;
    }
    .actions button { background: #3498db; color: white; border: none; padding: 5px 10px; margin-left: 5px; cursor: pointer; border-radius: 3px; }
    .actions .delete { background: #e74c3c; }
    .edit-input { display: flex; width: 100%; }
    .edit-input input { flex: 1; margin-right: 5px; }
    .edit-input button { background: #27ae60; }
    .edit-input button:last-child { background: #95a5a6; }
  </style>
</head>
<body>
  <h1>Todo List - Actividad 3.3</h1>
  <div>
    <input type="text" id="todoInput" placeholder="Nueva tarea..." />
    <button onclick="addTodo()">Agregar</button>
  </div>
  <ul id="todoList"></ul>

  <script>
    const api = '/api/todos';
    let editingId = null;

    async function loadTodos() {
      const res = await fetch(api);
      const todos = await res.json();
      const list = document.getElementById('todoList');
      list.innerHTML = '';
      todos.forEach(todo => {
        const li = document.createElement('li');
        li.innerHTML = editingId === todo.id ? 
          \`<div class="edit-input">
            <input type="text" id="editInput" value="\${todo.text}" />
            <button onclick="saveEdit()">✔</button>
            <button onclick="cancelEdit()">✖</button>
          </div>\` :
          \`<span ondblclick="startEdit(\${todo.id}, this)">\${todo.text}</span>
           <div class="actions">
             <button onclick="startEdit(\${todo.id}, this.parentElement.previousElementSibling)">✎</button>
             <button class="delete" onclick="deleteTodo(\${todo.id})">×</button>
           </div>\`;
        list.appendChild(li);
      });
      if (editingId) document.getElementById('editInput')?.focus();
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

    function startEdit(id, span) {
      editingId = id;
      loadTodos(); // Recarga con modo edición
    }

    async function saveEdit() {
      const input = document.getElementById('editInput');
      const text = input.value.trim();
      if (!text || !editingId) return;
      await fetch(\`\${api}/\${editingId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      editingId = null;
      loadTodos();
    }

    function cancelEdit() {
      editingId = null;
      loadTodos();
    }

    async function deleteTodo(id) {
      if (!confirm('¿Eliminar esta tarea?')) return;
      await fetch(\`\${api}/\${id}\`, { method: 'DELETE' });
      loadTodos();
    }

    // Cargar al inicio
    loadTodos();

    // Enter para agregar
    document.getElementById('todoInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') addTodo();
    });

    // Enter para guardar edición
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && editingId) saveEdit();
    });
  </script>
</body>
</html>
  `);
});

// Puerto dinámico
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});