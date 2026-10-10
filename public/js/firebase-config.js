const firebaseConfig = {
    apiKey: "AIzaSyDnPbG1EsmmMWVVQA1W2h9nnfgN_JLG5c8",
    authDomain: "recipes-eaa45.firebaseapp.com",
    projectId: "recipes-eaa45",
    messagingSenderId: "597807539706",
    appId: "1:597807539706:web:8a374fb8b315f5db1e7043",
    measurementId: "G-C80L2QYBFR"
};

firebase.initializeApp(firebaseConfig);

window.firebaseApp = firebase.app();
window.firebaseAnalytics = firebase.analytics();
window.firebaseAuth = firebase.auth();
