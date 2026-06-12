// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE FIREBASE
// Reemplazá los valores con los de tu proyecto en Firebase Console.
//
// Pasos para obtener la config:
//  1. Ir a https://console.firebase.google.com
//  2. Crear proyecto (o seleccionar uno existente)
//  3. Agregar app web (ícono </>)
//  4. Copiar el objeto firebaseConfig que aparece
//  5. Pegar los valores abajo
//
// También activar Firestore:
//  - En el menú lateral: Build → Firestore Database → Create database
//  - Elegir "Start in test mode" (para empezar sin restricciones)
// ─────────────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "REEMPLAZAR",
  authDomain:        "REEMPLAZAR.firebaseapp.com",
  projectId:         "REEMPLAZAR",
  storageBucket:     "REEMPLAZAR.appspot.com",
  messagingSenderId: "REEMPLAZAR",
  appId:             "REEMPLAZAR"
};

firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
