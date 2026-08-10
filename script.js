document.addEventListener('DOMContentLoaded', function() {
    const todoInput = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');
    const todoList = document.getElementById('todo-list');

    addBtn.addEventListener('click', function() {
        const taskText = todoInput.value.trim();
        if (taskText) {
            addTodo(taskText);
            todoInput.value = '';
        }
    });

    todoInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const taskText = todoInput.value.trim();
            if (taskText) {
                addTodo(taskText);
                todoInput.value = '';
            }
        }
    });

    function addTodo(text) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${text}</span>
            <button class="delete-btn">Delete</button>
        `;
        todoList.appendChild(li);

        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', function() {
            li.remove();
        });

        li.addEventListener('click', function() {
            li.classList.toggle('completed');
        });
    }
});