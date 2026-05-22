import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD6wSemwdq2bOI0XxKt2VqHzlEUgimt6Tg",
  authDomain: "gochat-41c3d.firebaseapp.com",
  projectId: "gochat-41c3d",
  messagingSenderId: "534494373412",
  appId: "1:534494373412:web:3c7fec493d324448151ab1",
};

const app = initializeApp(firebaseConfig);

export const messaging = getMessaging(app);
export const storage = getStorage(app);