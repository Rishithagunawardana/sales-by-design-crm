// Firebase Web App Configuration (Automatically generated from CLI)
const firebaseConfig = {
  projectId: "sale-by-design-homes-cde1b",
  appId: "1:1066621740840:web:f77fac7d1f93298c86921d",
  databaseURL: "https://sale-by-design-homes-cde1b-default-rtdb.firebaseio.com",
  storageBucket: "sale-by-design-homes-cde1b.firebasestorage.app",
  apiKey: "AIzaSyDGJIdvZXXx0hsRA44l3PuSANN-_zsBh7I",
  authDomain: "sale-by-design-homes-cde1b.firebaseapp.com",
  messagingSenderId: "1066621740840"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Expose services globally for other page scripts, checking if they are loaded first
window.firebaseAuth = typeof firebase.auth === 'function' ? firebase.auth() : null;
window.firebaseDb = typeof firebase.database === 'function' ? firebase.database() : null;

console.log("Firebase initialized successfully for Project:", firebaseConfig.projectId);
