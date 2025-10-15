/* Robust InfraFix script.js
   - Defensive; tries multiple selectors so HTML mismatches won't break it
   - localStorage signup/login/logout simulation
   - AI upload preview simulation (reads file, then swaps to preview-after)
   - Voting (simple per-session prevention)
   - Modal open/close enhancements (works with #modal anchors)
   - Mobile nav toggle (checkbox or button)
   - Safe: does not throw when elements are missing
*/

(function () {
  'use strict';

  function debugLog(...args) { console.info('[InfraFix]', ...args); }

  // Safe query helpers
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // -------------------------
  // LocalStorage helpers
  // -------------------------
  function getUsers() {
    try { return JSON.parse(localStorage.getItem('users')) || []; }
    catch (e) { return []; }
  }
  function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
  }
  function setLoggedIn(user) {
    localStorage.setItem('loggedInUser', JSON.stringify(user));
  }
  function getLoggedIn() {
    try { return JSON.parse(localStorage.getItem('loggedInUser')); } catch { return null; }
  }
  function clearLoggedIn() { localStorage.removeItem('loggedInUser'); }

  // -------------------------
  // Find forms and inputs robustly
  // -------------------------
  function findSignupForm() {
    // Look for explicit id first
    let f = $('#signup-form') || $('form[data-role="signup"]') || $('form#signup') || null;
    if (f) return f;

    // Otherwise heuristics: a form that has an email input + >=2 password inputs or "name" field
    for (const form of $$('form')) {
      const hasEmail = form.querySelector('input[type="email"], input[name*="email"], input[id*="email"]');
      const passwordInputs = form.querySelectorAll('input[type="password"]');
      const hasName = form.querySelector('input[name*="name"], input[id*="name"], input[placeholder*="name"]');
      if (hasEmail && (passwordInputs.length >= 2 || hasName)) return form;
    }
    return null;
  }

  function findLoginForm() {
    let f = $('#login-form') || $('form[data-role="login"]') || $('form#login') || null;
    if (f) return f;
    for (const form of $$('form')) {
      const hasPassword = form.querySelector('input[type="password"]');
      const hasUser = form.querySelector('input[type="email"], input[name*="user"], input[id*="login"], input[placeholder*="email"]');
      // avoid picking the signup form (with two passwords)
      const pwdCount = form.querySelectorAll('input[type="password"]').length;
      if (hasPassword && hasUser && pwdCount <= 1) return form;
    }
    return null;
  }

  // helper to find a best match input in a form given candidate selectors
  function pickInput(form, candidates) {
    for (const s of candidates) {
      const el = form.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  // -------------------------
  // Signup binding
  // -------------------------
  function bindSignup() {
    const form = findSignupForm();
    if (!form) { debugLog('No signup form found'); return; }
    debugLog('Signup form found', form);

    // find inputs
    const nameInput = pickInput(form, ['input[name="name"]','input[id*="name"]','input[placeholder*="Name"]','input#full-name']);
    const emailInput = pickInput(form, ['input[type="email"]','input[name="email"]','input[id*="email"]','input#email']);
    const pwInputs = form.querySelectorAll('input[type="password"]');
    const passwordInput = pwInputs[0] || pickInput(form, ['input[name="password"]','input[id*="password"]']);
    const confirmInput = pwInputs[1] || pickInput(form, ['input[name="confirm"]','input[id*="confirm"]','input[name="password_confirm"]']);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const name = nameInput ? nameInput.value.trim() : 'User';
      const email = emailInput ? (emailInput.value || '').trim() : '';
      const password = passwordInput ? (passwordInput.value || '') : '';
      const confirm = confirmInput ? (confirmInput.value || '') : '';

      if (!email || !password) { alert('Please fill required fields (email & password).'); return; }
      if (confirmInput && password !== confirm) { alert('Passwords do not match.'); return; }
      if (password.length < 6) { alert('Password should be at least 6 characters.'); return; }

      const users = getUsers();
      const exists = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      if (exists) { alert('Email already registered. Please login.'); return; }

      users.push({ name: name || email.split('@')[0], email, password, score: 0 });
      saveUsers(users);
      alert('Signup successful — you will be redirected to login.');
      debugLog('New user saved', email);
      setTimeout(() => { window.location.href = 'login.html'; }, 800);
    });
  }

  // -------------------------
  // Login binding
  // -------------------------
  function bindLogin() {
    const form = findLoginForm();
    if (!form) { debugLog('No login form found'); return; }
    debugLog('Login form found', form);

    const emailInput = pickInput(form, ['input[type="email"]','input[name="email"]','input[id*="email"]','input#login-username','input[name="username"]']);
    const passwordInput = pickInput(form, ['input[type="password"]','input[name="password"]','input[id*="password"]','input#login-password']);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const email = emailInput ? (emailInput.value || '').trim() : '';
      const password = passwordInput ? (passwordInput.value || '') : '';
      if (!email || !password) { alert('Please fill both email/username and password.'); return; }

      const users = getUsers();
      const user = users.find(u => (u.email && u.email.toLowerCase() === email.toLowerCase()) && (u.password === password));
      if (!user) { alert('Invalid credentials.'); return; }
      setLoggedIn(user);
      alert('Login successful! Redirecting to dashboard.');
      debugLog('Logged in user', user.email);
      setTimeout(() => { window.location.href = 'index.html'; }, 600);
    });
  }

  // -------------------------
  // Ensure header greeting + logout exists (inject if missing)
  // -------------------------
  function ensureHeaderControls() {
    // try to find brand area to inject greeting
    const brand = $('.brand') || $('.brand-text') || $('header .header-inner') || null;
    if (!brand) { debugLog('No header container found to inject greeting'); return; }

    // Create greeting element if not present
    let greeting = $('#user-greeting');
    if (!greeting) {
      greeting = document.createElement('div');
      greeting.id = 'user-greeting';
      greeting.className = 'user-greeting muted small';
      greeting.style.marginLeft = '12px';
      brand.appendChild(greeting);
      debugLog('Injected user greeting element');
    }

    let logout = $('#logout-btn');
    if (!logout) {
      logout = document.createElement('button');
      logout.id = 'logout-btn';
      logout.type = 'button';
      logout.style.display = 'none';
      logout.className = 'btn outline';
      logout.textContent = 'Logout';
      // append right side: try header-inner or brand
      const headerInner = $('.header-inner') || document.querySelector('header') || document.body;
      headerInner.appendChild(logout);
      debugLog('Injected logout button');
    }

    const current = getLoggedIn();
    if (current) {
      greeting.textContent = `Welcome, ${current.name || current.email}`;
      logout.style.display = 'inline-block';
    } else {
      greeting.textContent = '';
      logout.style.display = 'none';
    }

    logout.addEventListener('click', function () {
      clearLoggedIn();
      alert('You have been logged out.');
      debugLog('User logged out');
      window.location.href = 'login.html';
    });
  }

  // -------------------------
  // Nav toggle (checkbox or button)
  // -------------------------
  function bindNavToggle() {
    const toggle = $('#nav-toggle') || $('.nav-toggle') || $('#navToggle') || null;
    const navMenu = $('#nav-menu') || $('.nav-links') || $('.main-nav') || null;
    if (!toggle || !navMenu) { debugLog('Nav toggle or menu not found'); return; }
    // If toggle is a checkbox input
    if (toggle.tagName && toggle.tagName.toLowerCase() === 'input' && toggle.type === 'checkbox') {
      toggle.addEventListener('change', () => {
        navMenu.classList.toggle('active', toggle.checked);
      });
    } else {
      toggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
      });
    }
    debugLog('Nav toggle bound');
  }

  // -------------------------
  // AI preview: find a file input + preview image
  // -------------------------
 function bindAIUpload() {
  // Find file input (fallbacks included)
  let fileInput = $('#ai-upload') || $('#image-upload') || $('input[name="image"]') || $('input[type="file"].ai-upload') || $('section.ai-section input[type="file"]');
  if (!fileInput) fileInput = $('input[type="file"]');
  if (!fileInput) { debugLog('No file input found for AI upload'); return; }

  // Find preview areas
  const previewBefore = document.querySelector(".preview-before");
  const previewAfter = document.querySelector(".preview-after");
  // Find the Preview button
  const previewBtn = document.getElementById("preview-btn");

  if (!previewBtn) {
    console.error("No preview button (#preview-btn) found!");
    return;
  }

  // Trigger upload only on button click
  previewBtn.addEventListener("click", async function (e) {
    e.preventDefault(); // stop form submit

    const file = fileInput.files && fileInput.files[0];
    if (!file) { 
      alert("Please choose an image first!"); 
      return; 
    }

    // Show BEFORE preview locally
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (previewBefore) {
        previewBefore.style.backgroundImage = `url(${ev.target.result})`;
      }
    };
    reader.readAsDataURL(file);

    // Build form data
    const formData = new FormData();
    formData.append("file", file);

    try {
      alert("Uploading to InfraFix backend...");

      // Send file to FastAPI
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("Upload failed");

      // Get processed image back
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Show AFTER preview
      if (previewAfter) {
        previewAfter.style.backgroundImage = `url(${url})`;
      }

      alert("AI preview received from backend!");
    } catch (err) {
      console.error(err);
      alert("Error uploading image to backend.");
    }
  });

  debugLog("AI upload bound to", fileInput, "with button", previewBtn);
}

  

  // -------------------------
  // Voting system binding
  // -------------------------
  function bindVoting() {
    const voteSections = $$('.vote-section');
    if (!voteSections.length) { debugLog('No vote sections found'); return; }

    voteSections.forEach(section => {
      try {
        const up = section.querySelector('.upvote');
        const down = section.querySelector('.downvote');
        const count = section.querySelector('.vote-count');
        if (!count) {
          // if not present, create one
          const c = document.createElement('span');
          c.className = 'vote-count';
          c.textContent = '0';
          section.appendChild(c);
        }
        let voted = false;
        if (up) up.addEventListener('click', () => {
          if (voted) { alert('You already voted in this session'); return; }
          count.textContent = (parseInt(count.textContent || '0', 10) + 1);
          voted = true;
          alert('Upvoted — thanks!');
        });
        if (down) down.addEventListener('click', () => {
          if (voted) { alert('You already voted in this session'); return; }
          count.textContent = (parseInt(count.textContent || '0', 10) - 1);
          voted = true;
          alert('Downvoted — noted.');
        });
      } catch (e) {
        debugLog('Voting bind error', e);
      }
    });
    debugLog('Voting bound to', voteSections.length, 'sections');
  }

  // -------------------------
  // Modal helpers: open links with href="#modal" also show via JS
  // -------------------------
  function bindModalEnhancements() {
    const modal = document.getElementById('modal') || document.querySelector('.modal');
    if (!modal) { debugLog('No modal element found'); return; }

    // If modal uses :target, clicking anchor will still work; we enhance by allowing buttons with data-open-modal
    // Show or hide modal by toggling inline style (for accessibility we can set aria-hidden)
    function showModal() {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      // focus first focusable inside
      const focusable = modal.querySelector('input,button,a,textarea,select');
      if (focusable) focusable.focus();
    }
    function hideModal() {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }

    // openers: [a[href="#modal"], button[data-open="modal"]]
    $$('.open-modal, a[href="#modal"], button[data-open="modal"]').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        showModal();
      });
    });

    // closers: .modal-close or [data-close-modal]
    $$('.modal-close, button[data-close-modal], a.close-modal').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        hideModal();
      });
    });

    // ESC to close
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') hideModal();
    });

    debugLog('Modal enhancements bound');
  }

  // -------------------------
  // Initialize all bindings
  // -------------------------
  function init() {
    debugLog('Initializing InfraFix script');
    bindSignup();
    bindLogin();
    ensureHeaderControls();
    bindNavToggle();
    bindAIUpload();
    bindVoting();
    bindModalEnhancements();
    debugLog('InfraFix script initialization complete');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
