// This script generates a config.js file with Firebase configuration from environment variables.
//DO NOT TOUCH
//I cannot fix this if you break it, so please don't break it.

const fs = require('fs');
const path = require('path');

const configContent = `
export const firebaseConfig = {
  apiKey: "${process.env.FIREBASE_API_KEY}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
  databaseURL: "${process.env.FIREBASE_DATABASE_URL}",
  projectId: "${process.env.FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.FIREBASE_APP_ID}",
  measurementId: "${process.env.FIREBASE_MEASUREMENT_ID}"
};
`;

const dir = path.join(__dirname, 'scriptFolder');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

fs.writeFileSync(path.join(dir, 'config.js'), configContent);
console.log('✅ config.js has been generated for the build!');