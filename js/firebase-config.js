// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyDWA7UCprKOEWlaIoSbw-_EcNM9PIO4wow",
	authDomain: "cadd-vault-f8fc0.firebaseapp.com",
	projectId: "cadd-vault-f8fc0",
	storageBucket: "cadd-vault-f8fc0.firebasestorage.app",
	messagingSenderId: "613470547495",
	appId: "1:613470547495:web:56640d735c0d44a5802802",
	measurementId: "G-SPS76ZJYG9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);