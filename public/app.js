// ================================================================
// app.js - Velox Taxi Complete
// ================================================================

// ================================================================
// STORAGE FUNCTIONS
// ================================================================

function getUserFromStorage() {
    try {
        const userData = localStorage.getItem('velox_user');
        if (userData) {
            return JSON.parse(userData);
        }
    } catch (e) {
        console.error('Error reading user:', e);
    }
    return null;
}

function saveUserToStorage(user) {
    try {
        localStorage.setItem('velox_user', JSON.stringify(user));
        console.log('💾 User saved:', user);
    } catch (e) {
        console.error('Error saving user:', e);
    }
}

function clearUser() {
    localStorage.removeItem('velox_user');
    localStorage.removeItem('velox_session');
    console.log('👋 Logged out');
    window.location.href = '/index.html';
}

// ================================================================
// UI UPDATE
// ================================================================

function updateUserBadge(user) {
    if (!user) {
        console.warn('⚠️ No user to display');
        return;
    }
    
    const role = (user.role || 'passenger').toUpperCase();
    const name = user.full_name || user.name || user.email || 'User';
    
    const roleEl = document.getElementById('user-role');
    const nameEl = document.getElementById('user-name');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (roleEl) roleEl.textContent = role;
    if (nameEl) nameEl.textContent = name;
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    
    console.log(`✅ Badge: ${name} - ${role}`);
}

// ================================================================
// ✅ NAVIGATION FUNCTION (works with goTo)
// ================================================================

function goTo(app) {
    console.log(`🔗 goTo called for: ${app}`);
    
    const userData = localStorage.getItem('velox_user');
    if (!userData) {
        alert('Please login first! Click the Login button.');
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        const role = user.role || 'passenger';
        
        console.log(`👤 User role: ${role}, Trying to access: ${app}`);
        
        if (role === app) {
            console.log(`✅ Access granted to ${app}`);
            window.location.href = `/${app}.html`;
        } else {
            alert(`❌ Access denied. You are registered as a ${role}, not a ${app}.`);
        }
    } catch (e) {
        console.error('Error parsing user:', e);
        alert('Please login again.');
        localStorage.removeItem('velox_user');
        window.location.href = '/index.html';
    }
}

// ================================================================
// ✅ ALIAS FUNCTION (works with navigateToApp)
// ================================================================

function navigateToApp(app) {
    console.log(`🔗 navigateToApp called for: ${app}`);
    goTo(app);  // Call the existing goTo function
}

// ================================================================
// AUTH FUNCTIONS
// ================================================================

async function loginUser(email, password) {
    console.log('🔑 Logging in:', email);
    
    const messageEl = document.getElementById('auth-message');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('📥 Login response:', data);
        
        if (data.success) {
            const user = {
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.full_name || 'User',
                role: data.user.role || 'passenger',
                session: data.session
            };
            
            saveUserToStorage(user);
            updateUserBadge(user);
            
            if (messageEl) {
                messageEl.textContent = '✅ Login successful!';
                messageEl.style.color = '#00f5d4';
            }
            
            const role = user.role || 'passenger';
            setTimeout(() => {
                window.location.href = `/${role}.html`;
            }, 1000);
            
            return true;
        } else {
            if (messageEl) {
                messageEl.textContent = '❌ ' + (data.error || 'Login failed');
                messageEl.style.color = '#ff4444';
            }
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        if (messageEl) {
            messageEl.textContent = '❌ ' + error.message;
            messageEl.style.color = '#ff4444';
        }
        return false;
    }
}

async function registerUser(email, password, full_name, user_type) {
    console.log('📝 Registering:', email);
    
    const messageEl = document.getElementById('auth-message');
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, full_name, user_type })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (messageEl) {
                messageEl.textContent = '✅ Registration successful! Please login.';
                messageEl.style.color = '#00f5d4';
            }
            return true;
        } else {
            if (messageEl) {
                messageEl.textContent = '❌ ' + (data.error || 'Registration failed');
                messageEl.style.color = '#ff4444';
            }
            return false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        if (messageEl) {
            messageEl.textContent = '❌ ' + error.message;
            messageEl.style.color = '#ff4444';
        }
        return false;
    }
}

// ================================================================
// AUTH FORM HANDLER
// ================================================================

async function handleAuthSubmit(event, type) {
    event.preventDefault();
    console.log(`🔐 ${type} form submitted`);
    
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    
    if (!email || !password) {
        const messageEl = document.getElementById('auth-message');
        if (messageEl) {
            messageEl.textContent = '❌ Please fill in all fields';
            messageEl.style.color = '#ff4444';
        }
        return;
    }
    
    if (type === 'login') {
        await loginUser(email, password);
    } else if (type === 'register') {
        const name = document.getElementById('reg-name')?.value;
        const role = document.getElementById('reg-role')?.value;
        if (name && role) {
            await registerUser(email, password, name, role);
        } else {
            const messageEl = document.getElementById('auth-message');
            if (messageEl) {
                messageEl.textContent = '❌ Please fill in all fields';
                messageEl.style.color = '#ff4444';
            }
        }
    }
}

function closeAuthModal() {
    document.getElementById('auth-overlay').style.display = 'none';
}

// ================================================================
// INITIALIZATION
// ================================================================

function initializeApp() {
    console.log('🔧 Initializing app...');
    
    const user = getUserFromStorage();
    if (user) {
        console.log('✅ User found:', user);
        updateUserBadge(user);
        
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        console.log('ℹ️ No user logged in');
    }
}

// ================================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ================================================================

window.loginUser = loginUser;
window.registerUser = registerUser;
window.handleAuthSubmit = handleAuthSubmit;
window.goTo = goTo;
window.navigateToApp = navigateToApp;
window.clearUser = clearUser;
window.getUserFromStorage = getUserFromStorage;
window.closeAuthModal = closeAuthModal;

// ================================================================
// EVENT LISTENERS
// ================================================================

document.addEventListener('DOMContentLoaded', initializeApp);

console.log('✅ app.js loaded successfully');
