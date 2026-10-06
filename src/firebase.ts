// firebase.js 파일 내부 예시

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// 본인의 개인 키값이 들어있는 설정 객체
const firebaseConfig = {
  apiKey: "AIzaSyCUi1umYQ967fTz8RW841_CVFl0A1iCN04",
  authDomain: "for-all-cdd08.firebaseapp.com",
  projectId: "for-all-cdd08",
  storageBucket: "for-all-cdd08.firebasestorage.app",
  messagingSenderId: "395591690774",
  appId: "1:395591690774:web:0d6dc1209f9d04c5c22337",
  measurementId: "G-96K344VN6W",
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export default app;
