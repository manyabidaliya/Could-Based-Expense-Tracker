// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOfNxjvwz7JbMXai5W_8n2IY61nhYSa7c",
  authDomain: "expense-tracker-3b153.firebaseapp.com",
  databaseURL: "https://expense-tracker-3b153-default-rtdb.firebaseio.com",
  projectId: "expense-tracker-3b153",
  storageBucket: "expense-tracker-3b153.appspot.com",
  messagingSenderId: "63033865143",
  appId: "1:63033865143:web:82c051dff17c300de3ee32",
  measurementId: "G-FDKGBK8N9C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DOM elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const expenseList = document.getElementById('expenseList');
const totalAmountElem = document.getElementById('totalAmount');
const summaryList = document.getElementById('summaryList');
const alertMsg = document.getElementById('alertMsg');
const categoryFilter = document.getElementById('filterCategory');
const monthFilter = document.getElementById('monthFilter');
const sortBySelect = document.getElementById('sortBy');
const addBtn = document.getElementById('addBtn');
const categoryInput = document.getElementById('category');
const amountInput = document.getElementById('amount');
const noteInput = document.getElementById('note');
const limitInput = document.getElementById('limitInput');
const toggleBtn = document.getElementById('toggleBtn');
const ctx = document.getElementById('expenseChart').getContext('2d');

let expenses = {};
let editingExpenseId = null;
let spendingLimit = null;
let expenseChart = null;

// Authentication
function login() {
  const email = emailInput.value;
  const password = passInput.value;
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
}

function signUp() {
  const email = emailInput.value;
  const password = passInput.value;
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(() => alert('Account created. Please log in.'))
    .catch(err => alert(err.message));
}

function logout() {
  firebase.auth().signOut();
}

window.login = login;
window.signUp = signUp;
window.logout = logout;

// Auth listener
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    detectLocation();
    fetchExpenses();
  } else {
    appScreen.style.display = 'none';
    loginScreen.style.display = 'block';
  }
});

// Spending limit
function setSpendingLimit() {
  const limit = parseFloat(limitInput.value);
  if (isNaN(limit) || limit <= 0) {
    alertMsg.textContent = 'Please enter a valid positive spending limit.';
    return;
  }
  spendingLimit = limit;
  alertMsg.textContent = `Spending limit set to ₹${spendingLimit}`;
  limitInput.value = '';
  renderExpenses();
}
window.setSpendingLimit = setSpendingLimit;

// Fetch expenses from correct user path
function fetchExpenses() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  db.ref('users/' + user.uid + '/expenses').on('value', snapshot => {
    expenses = snapshot.val() || {};
    renderExpenses();
  });
}

// Render
function renderExpenses() {
  let filtered = Object.entries(expenses).filter(([_, exp]) => {
    const catMatch = !categoryFilter.value || exp.category === categoryFilter.value;
    const monthMatch = !monthFilter.value || (exp.date && exp.date.slice(5, 7) === monthFilter.value);
    return catMatch && monthMatch;
  });

  filtered.sort((a, b) => {
    const [_, A] = a, [__, B] = b;
    if (sortBySelect.value === 'newest') return new Date(B.date) - new Date(A.date);
    if (sortBySelect.value === 'oldest') return new Date(A.date) - new Date(B.date);
    if (sortBySelect.value === 'high') return parseFloat(B.amount) - parseFloat(A.amount);
    if (sortBySelect.value === 'low') return parseFloat(A.amount) - parseFloat(B.amount);
    return 0;
  });

  expenseList.innerHTML = '';
  let total = 0;
  filtered.forEach(([id, exp]) => {
    total += parseFloat(exp.amount);
    const div = document.createElement('div');
    div.className = 'expense-item';
    div.innerHTML = `
      <div><strong>${exp.category}</strong> - ₹${parseFloat(exp.amount).toFixed(2)}</div>
      <div>${exp.note || ''}</div>
      <div>${exp.date || ''}</div>
      <div>
        <button onclick="editExpense('${id}')">Edit</button>
        <button onclick="deleteExpense('${id}')">Delete</button>
      </div>
    `;
    expenseList.appendChild(div);
  });

  totalAmountElem.textContent = total.toFixed(2);

  if (spendingLimit !== null && total > spendingLimit) {
    alertMsg.textContent = `⚠ Warning! You have exceeded your spending limit of ₹${spendingLimit}`;
  } else if (alertMsg.textContent.includes('Warning')) {
    alertMsg.textContent = '';
  }

  const summaryMap = {};
  filtered.forEach(([_, exp]) => {
    summaryMap[exp.category] = (summaryMap[exp.category] || 0) + parseFloat(exp.amount);
  });
  summaryList.innerHTML = '';
  const labels = [], values = [];
  Object.entries(summaryMap).forEach(([cat, amt]) => {
    labels.push(cat);
    values.push(amt);
    const li = document.createElement('li');
    li.textContent = `${cat}: ₹${amt.toFixed(2)}`;
    summaryList.appendChild(li);
  });

  // Render pie chart
  if (expenseChart) expenseChart.destroy();
  expenseChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Expenses by Category',
        data: values,
        backgroundColor: [
          '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#17a2b8', '#fd7e14'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// Add or update
function addOrUpdateExpense() {
  const user = firebase.auth().currentUser;
  if (!user) return alert('User not logged in.');

  const category = categoryInput.value;
  const amount = parseFloat(amountInput.value);
  const note = noteInput.value.trim();
  const date = new Date().toISOString().slice(0, 10);
  if (!category) return alert('Please select a category.');
  if (isNaN(amount) || amount <= 0) return alert('Please enter a valid positive amount.');

  const data = { category, amount, note, date };

  if (editingExpenseId) {
    db.ref('users/' + user.uid + '/expenses/' + editingExpenseId).set(data);
    editingExpenseId = null;
    addBtn.textContent = 'Add Expense';
  } else {
    db.ref('users/' + user.uid + '/expenses').push(data);
  }

  categoryInput.value = '';
  amountInput.value = '';
  noteInput.value = '';
}
window.addOrUpdateExpense = addOrUpdateExpense;

function editExpense(id) {
  const exp = expenses[id];
  if (!exp) return alert('Expense not found');
  editingExpenseId = id;
  categoryInput.value = exp.category;
  amountInput.value = exp.amount;
  noteInput.value = exp.note || '';
  addBtn.textContent = 'Update Expense';
}
window.editExpense = editExpense;

function deleteExpense(id) {
  const user = firebase.auth().currentUser;
  if (!user) return alert('User not logged in.');

  if (confirm('Are you sure you want to delete this expense?')) {
    db.ref('users/' + user.uid + '/expenses/' + id).remove();
    if (editingExpenseId === id) {
      editingExpenseId = null;
      addBtn.textContent = 'Add Expense';
      categoryInput.value = '';
      amountInput.value = '';
      noteInput.value = '';
    }
  }
}
window.deleteExpense = deleteExpense;

// Filters & UI
categoryFilter.addEventListener('change', renderExpenses);
monthFilter.addEventListener('change', renderExpenses);
sortBySelect.addEventListener('change', renderExpenses);
addBtn.addEventListener('click', addOrUpdateExpense);

toggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  toggleBtn.textContent = document.body.classList.contains('dark-mode') ? 'Toggle Light Mode' : 'Toggle Dark Mode';
});

// Location detection
function detectLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      document.getElementById('location').textContent = `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`;
    });
  }
}
window.detectLocation = detectLocation;
