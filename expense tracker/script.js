let expenses = [];

window.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("expenseList");
  const totalDisplay = document.getElementById("totalAmount");
  const addBtn = document.getElementById("addBtn");
  const toggleBtn = document.getElementById("toggleBtn");
  const filterCategory = document.getElementById("filterCategory");
  const sortBy = document.getElementById("sortBy");

  // Load from localStorage
  const saved = JSON.parse(localStorage.getItem("expenses")) || [];
  expenses = saved;
  renderExpenses();

  // Load theme
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
  }

  toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const mode = document.body.classList.contains("dark-mode") ? "dark" : "light";
    localStorage.setItem("theme", mode);
  });

  addBtn.addEventListener("click", () => {
    const category = document.getElementById("category").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const note = document.getElementById("note").value.trim();
    const date = new Date().toISOString();

    if (!category || isNaN(amount) || amount <= 0) {
      alert("Please select a category and enter a valid amount.");
      return;
    }

    const expense = {
      id: Date.now(),
      category,
      amount,
      note,
      date,
    };

    expenses.push(expense);
    saveAndRender();
    clearInputs();
  });

  filterCategory.addEventListener("change", renderExpenses);
  sortBy.addEventListener("change", renderExpenses);

  function renderExpenses() {
    let filtered = [...expenses];

    // Filter
    const filterValue = filterCategory.value;
    if (filterValue) {
      filtered = filtered.filter(e => e.category === filterValue);
    }

    // Sort
    const sortValue = sortBy.value;
    if (sortValue === "newest") {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortValue === "oldest") {
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortValue === "high") {
      filtered.sort((a, b) => b.amount - a.amount);
    } else if (sortValue === "low") {
      filtered.sort((a, b) => a.amount - b.amount);
    }

    list.innerHTML = "";
    let total = 0;

    filtered.forEach((exp) => {
      total += exp.amount;

      const div = document.createElement("div");
      div.className = "expense-row";
      div.innerHTML = `
        <div>
          <strong>${exp.category}</strong>: ₹${exp.amount}
          <small> | ${new Date(exp.date).toLocaleDateString()}</small>
          <br>${exp.note ? exp.note : ""}
        </div>
        <div class="controls">
          <button onclick="editExpense(${exp.id})">Edit</button>
          <button onclick="deleteExpense(${exp.id})">Delete</button>
        </div>
      `;
      list.appendChild(div);
    });

    totalDisplay.textContent = total;
  }

  function clearInputs() {
    document.getElementById("category").value = "";
    document.getElementById("amount").value = "";
    document.getElementById("note").value = "";
  }

  function saveAndRender() {
    localStorage.setItem("expenses", JSON.stringify(expenses));
    renderExpenses();
  }

  window.deleteExpense = function (id) {
    expenses = expenses.filter(e => e.id !== id);
    saveAndRender();
  };

  window.editExpense = function (id) {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;

    document.getElementById("category").value = exp.category;
    document.getElementById("amount").value = exp.amount;
    document.getElementById("note").value = exp.note;

    deleteExpense(id);
  };
});
