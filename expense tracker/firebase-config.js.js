// Your web app's Firebase configuration
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const loginScreen   = document.getElementById('login-screen');
const appScreen     = document.getElementById('app');
const emailInput    = document.getElementById('email');
const passInput     = document.getElementById('password');
const expenseList   = document.getElementById('expenseList');
const totalAmountElem = document.getElementById('totalAmount');
const summaryList   = document.getElementById('summaryList');
const alertMsg      = document.getElementById('alertMsg');
const categoryFilter = document.getElementById('filterCategory');
const monthFilter   = document.getElementById('monthFilter');
const sortBySelect  = document.getElementById('sortBy');
const addBtn        = document.getElementById('addBtn');
const categoryInput = document.getElementById('category');
const amountInput   = document.getElementById('amount');
const noteInput     = document.getElementById('note');
const limitInput    = document.getElementById('limitInput');
const toggleBtn     = document.getElementById('toggleBtn');
const exportCSVBtn  = document.getElementById('exportCSV');
const googleSignInBtn = document.getElementById('googleSignIn');
const expenseChartCanvas = document.getElementById('expenseChart');

let expenses = {};
let editingExpenseId = null;
let spendingLimit = null;
let expensesRef = null;
let chart = null;

// Authentication
function login() {
  const email = emailInput.value.trim();
  const password = passInput.value;
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
}

function signUp() {
  const email = emailInput.value.trim();
  const password = passInput.value;
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(() => alert('Account created. Please log in.'))
    .catch(err => {
      if (err.code === 'auth/email-already-in-use') {
        alert('This email is already registered. Please log in.');
      } else if (err.code === 'auth/invalid-email') {
        alert('Invalid email format.');
      } else if (err.code === 'auth/weak-password') {
        alert('Password should be at least 6 characters.');
      } else {
        alert(err.message);
      }
    });
}

function logout() {
  firebase.auth().signOut();
}

// Google Sign-In
if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
      .catch(err => alert(err.message));
  });
}

// Expose globally
window.login = login;
window.signUp = signUp;
window.logout = logout;

// Auth state listener
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    loginScreen.style.display = 'none';
    appScreen.style.display   = 'block';
    detectLocation();
    fetchExpenses();
  } else {
    if (expensesRef) expensesRef.off();
    appScreen.style.display   = 'none';
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

// Fetch & render (per user)
function fetchExpenses() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  if (expensesRef) expensesRef.off();
  expensesRef = db.ref('expenses/' + user.uid);
  expensesRef.on('value', snapshot => {
    expenses = snapshot.val() || {};
    renderExpenses();
    renderChart();
  });
}

function renderExpenses() {
  let filtered = Object.entries(expenses).filter(([_, exp]) => {
    const catMatch = !categoryFilter.value || exp.category === categoryFilter.value;
    const monthMatch = !monthFilter.value || (exp.date && exp.date.slice(5,7) === monthFilter.value);
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
    div.className = 'expense-item row align-items-center';
    div.innerHTML = `
      <div class="col-4"><strong>${exp.category}</strong> - ₹${parseFloat(exp.amount).toFixed(2)}</div>
      <div class="col-3">${exp.note || ''}</div>
      <div class="col-3">${exp.date || ''}</div>
      <div class="col-2">
        <button onclick="editExpense('${id}')" class="btn btn-sm btn-warning">Edit</button>
        <button onclick="deleteExpense('${id}')" class="btn btn-sm btn-danger">Delete</button>
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
  Object.entries(summaryMap).forEach(([cat, amt]) => {
    const li = document.createElement('li');
    li.textContent = `${cat}: ₹${amt.toFixed(2)}`;
    summaryList.appendChild(li);
  });
}

// Add / update (per user)
function addOrUpdateExpense() {
  const user = firebase.auth().currentUser;
  if (!user) return alert('Not logged in!');
  const userExpensesRef = db.ref('expenses/' + user.uid);

  const category = categoryInput.value;
  const amount   = parseFloat(amountInput.value);
  const note     = noteInput.value.trim();
  const date     = new Date().toISOString().slice(0,10);
  if (!category) return alert('Please select a category.');
  if (isNaN(amount) || amount <= 0) return alert('Please enter a valid positive amount.');
  const data = { category, amount, note, date };
  if (editingExpenseId) {
    userExpensesRef.child(editingExpenseId).set(data);
    editingExpenseId = null;
    addBtn.textContent   = 'Add Expense';
  } else {
    userExpensesRef.push(data);
  }
  categoryInput.value = '';
  amountInput.value   = '';
  noteInput.value     = '';
}
window.addOrUpdateExpense = addOrUpdateExpense;

function editExpense(id) {
  const exp = expenses[id];
  if (!exp) return alert('Expense not found');
  editingExpenseId     = id;
  categoryInput.value  = exp.category;
  amountInput.value    = exp.amount;
  noteInput.value      = exp.note || '';
  addBtn.textContent   = 'Update Expense';
}
window.editExpense = editExpense;

function deleteExpense(id) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  if (confirm('Are you sure you want to delete this expense?')) {
    db.ref('expenses/' + user.uid + '/' + id).remove();
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

// Export to CSV
if (exportCSVBtn) {
  exportCSVBtn.addEventListener('click', function() {
    let csv = "Category,Amount,Note,Date\n";
    Object.values(expenses).forEach(exp => {
      csv += `${exp.category},${exp.amount},"${exp.note}",${exp.date}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Chart.js for category-wise spending
function renderChart() {
  if (!expenseChartCanvas) return;
  const categories = {};
  Object.values(expenses).forEach(exp => {
    categories[exp.category] = (categories[exp.category] || 0) + parseFloat(exp.amount);
  });
  const data = {
    labels: Object.keys(categories),
    datasets: [{
      data: Object.values(categories),
      backgroundColor: [
        '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#2ecc40', '#ff851b', '#7fdbff'
      ]
    }]
  };
  if (chart) chart.destroy();
  chart = new Chart(expenseChartCanvas, {
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// Location detection (optional implementation)
function detectLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      document.getElementById('location').textContent = `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`;
    });
  }
}
window.detectLocation = detectLocation;