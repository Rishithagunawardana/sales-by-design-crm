document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect to dashboard
  firebaseAuth.onAuthStateChanged(user => {
    if (user) {
      window.location.href = 'dashboard.html';
    }
  });

  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');
  const errorBanner = document.getElementById('error-banner');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous errors
    errorBanner.style.display = 'none';
    errorBanner.innerText = '';
    
    const email = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }
    
    // Show spinner & disable button
    setLoading(true);
    
    try {
      // Use Firebase Authentication
      try {
        await firebaseAuth.signInWithEmailAndPassword(email, password);
        localStorage.setItem('currentUser', email);
        window.location.href = 'dashboard.html';
      } catch (err) {
        console.warn('Firebase Auth sign-in failed, checking credential status...', err.code);
        
        // Handle auto-seeding for the default admin account
        if (email.toLowerCase() === 'admin@salesbydesign.com' && password === 'admin123' && 
            (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
          try {
            console.log('Default admin account not found or invalid. Auto-seeding account to Firebase...');
            await firebaseAuth.createUserWithEmailAndPassword(email, password);
            localStorage.setItem('currentUser', email);
            window.location.href = 'dashboard.html';
          } catch (seedErr) {
            console.error('Failed to auto-seed admin account:', seedErr);
            showError('Authentication failed. Please verify your credentials.');
          }
        } else if (err.code === 'auth/wrong-password') {
          showError('Incorrect password. Please try again.');
        } else if (err.code === 'auth/invalid-email') {
          showError('Invalid email address format.');
        } else if (err.code === 'auth/user-disabled') {
          showError('This user account has been disabled.');
        } else {
          // Fallback generic error
          showError('Invalid email or password.');
        }
      }
    } catch (err) {
      console.error('Login flow error:', err);
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  function showError(message) {
    errorBanner.innerText = message;
    errorBanner.style.display = 'block';
    
    // Reset and trigger CSS shake animation
    errorBanner.style.animation = 'none';
    errorBanner.offsetHeight; // trigger reflow
    errorBanner.style.animation = 'shake 0.4s ease-in-out';
  }

  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline-block';
    } else {
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }
});
