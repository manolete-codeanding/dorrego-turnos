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
  apiKey:            "AIzaSyD_Iv536pxgUDGNEOs0jFXH5KI24jKfYkU",
  authDomain:        "dorrego-turnos-b3388.firebaseapp.com",
  projectId:         "dorrego-turnos-b3388",
  storageBucket:     "dorrego-turnos-b3388.firebasestorage.app",
  messagingSenderId: "627354990926",
  appId:             "1:627354990926:web:77d5b3013b18b3d821061f"
};

firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
