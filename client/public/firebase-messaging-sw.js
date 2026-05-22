importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD6wSemwdq2bOI0XxKt2VqHzlEUgimt6Tg",
  authDomain: "gochat-41c3d.firebaseapp.com",
  projectId: "gochat-41c3d",
  messagingSenderId: "534494373412",
  appId: "1:534494373412:web:3c7fec493d324448151ab1",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.data.title;
  const options = {
    body: payload.data.body,
    icon: "/logo192.png",
  };

  self.registration.showNotification(title, options);
});