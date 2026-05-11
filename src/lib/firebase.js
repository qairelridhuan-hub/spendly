// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyASk5LevC-uI3_7RmP8ogbnC4ubeoa49s0",
  authDomain: "spendly-68ea0.firebaseapp.com",
  projectId: "spendly-68ea0",
  storageBucket: "spendly-68ea0.firebasestorage.app",
  messagingSenderId: "761591899210",
  appId: "1:761591899210:web:30faf58a51ba1c341972b3",
  measurementId: "G-ZF5VLF3DT9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);