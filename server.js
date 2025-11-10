const express = require('express');
const { Pool } = require('pg');
const app = express();

// === Config DB ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.json());

// Crear tabla
pool.query(`
  CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);

// === API CRUD ===
app.get('/api/todos', async (req, res) => {
  const result = await pool.query('SELECT id, text, created_at FROM todos ORDER BY created_at DESC');
  res.json(result.rows);
});

app.get('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('SELECT id, text, created_at FROM todos WHERE id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
  res.json(result.rows[0]);
});

app.post('/api/todos', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });
  const result = await pool.query(
    'INSERT INTO todos (text) VALUES ($1) RETURNING id, text, created_at',
    [text.trim()]
  );
  res.status(201).json(result.rows[0]);
});

app.put('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });
  const result = await pool.query(
    'UPDATE todos SET text = $1 WHERE id = $2 RETURNING id, text, created_at',
    [text.trim(), id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
  res.json(result.rows[0]);
});

app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM todos WHERE id = $1', [id]);
  res.status(204).send();
});

// === Frontend Dark Mode ===
app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Todo List - Actividad 3.3</title>
  <style>
    body {font-family: Arial; max-width: 700px; margin: 40px auto; padding: 20px; background: #121212; color: #e0e0e0;}
    h1 {text-align:center; color:#90caf9;}
    h2 {text-align:center;}
    input, button {padding:10px; font-size:16px; border-radius:5px;}
    input {width:65%; border:1px solid #555; background:#1e1e1e; color:#fff;}
    .add-btn {background:#66bb6a; color:white; border:none;}
    ul {list-style:none; padding:0;}
    li {background:#1e1e1e; padding:15px; margin:10px 0; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.5); display:flex; justify-content:space-between; align-items:center;}
    .actions button {padding:8px 12px; margin-left:5px; border:none; border-radius:4px; color:white; cursor:pointer;}
    .view {background:#42a5f5;}
    .edit {background:#ffb74d;}
    .delete {background:#ef5350;}
    .edit-input {display:flex; width:100%;}
    .edit-input input {flex:1; margin-right:10px; background:#1e1e1e; color:#fff; border:1px solid #555;}
    .edit-input button:first-child {background:#66bb6a;}
    .edit-input button:last-child {background:#757575;}
    small {color:#aaa; font-size:0.9em;}
    #detailModal {display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); justify-content:center; align-items:center; z-index:999;}
    .modal-content {background:#1e1e1e; color:#e0e0e0; padding:30px; border-radius:12px; width:90%; max-width:500px; position:relative;}
    .close {position:absolute; top:10px; right:15px; font-size:28px; cursor:pointer; color:#aaa;}
    .close:hover {color:#fff;}
    .modal-content button {background:#42a5f5; color:white; border:none; border-radius:5px; padding:10px 20px; cursor:pointer;}
  </style>
</head>
<body>
  <h1>Todo List - Actividad 3.3</h1>
  <h2>Jonathan Jovany Ramirez</h2>
  <div style="text-align:center; margin:20px 0;">
    <input type="text" id="todoInput" placeholder="Nueva tarea..." />
    <button class="add-btn" onclick="addTodo()">Agregar</button>
  </div>
  <ul id="todoList"></ul>

  <!-- Modal -->
  <div id="detailModal">
    <div class="modal-content">
      <span class="close" onclick="closeModal()">&times;</span>
      <h3>Detalle completo</h3>
      <div id="detailContent"></div>
      <button onclick="closeModal()">Cerrar</button>
    </div>
  </div>

  <script>
    const api = '/api/todos';
    let editingId = null;

    async function loadTodos() {
      const res = await fetch(api);
      const todos = await res.json();
      const list = document.getElementById('todoList');
      list.innerHTML = '';
      todos.forEach(todo => {
        const date = new Date(todo.created_at).toLocaleString('es-MX');
        const li = document.createElement('li');
        
        li.innerHTML = editingId === todo.id ? 
          \`<div class="edit-input">
            <input type="text" id="editInput" value="\${todo.text}" />
            <button onclick="saveEdit()">✔</button>
            <button onclick="cancelEdit()">✖</button>
          </div>\` :
          \`<div>
            <strong ondblclick="startEdit(\${todo.id})">\${todo.text}</strong>
            <br><small>ID: \${todo.id} | \${date}</small>
          </div>
          <div class="actions">
            <button class="view" onclick="showDetail(\${todo.id})">👁️</button>
            <button class="edit" onclick="startEdit(\${todo.id})">✎</button>
            <button class="delete" onclick="deleteTodo(\${todo.id})">×</button>
          </div>\`;
        list.appendChild(li);
      });
    }

    async function showDetail(id) {
      const res = await fetch(\`\${api}/\${id}\`);
      const todo = await res.json();
      const date = new Date(todo.created_at).toLocaleString('es-MX');
      document.getElementById('detailContent').innerHTML = \`
        <p><strong>ID:</strong> \${todo.id}</p>
        <p><strong>Tarea:</strong> \${todo.text}</p>
        <p><strong>Creado:</strong> \${date}</p>
      \`;
      document.getElementById('detailModal').style.display = 'flex';
    }

    function closeModal() {
      document.getElementById('detailModal').style.display = 'none';
    }

    async function addTodo() {
      const input = document.getElementById('todoInput');
      const text = input.value.trim();
      if (!text) return;
      await fetch(api, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text})});
      input.value = '';
      loadTodos();
    }

    function startEdit(id) {
      editingId = id;
      loadTodos();
    }

    async function saveEdit() {
      const input = document.getElementById('editInput');
      const text = input.value.trim();
      if (!text) return;
      await fetch(\`\${api}/\${editingId}\`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text})});
      editingId = null;
      loadTodos();
    }

    function cancelEdit() {
      editingId = null;
      loadTodos();
    }

    async function deleteTodo(id) {
      if (!confirm('¿Eliminar?')) return;
      await fetch(\`\${api}/\${id}\`, {method:'DELETE'});
      loadTodos();
    }

    loadTodos();

    document.getElementById('todoInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') addTodo();
    });

    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    window.addEventListener('click', e => {
      if (e.target === document.getElementById('detailModal')) closeModal();
    });
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
