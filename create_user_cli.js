const admin = require('firebase-admin');

// Firebase hizmet hesabı anahtarınızın yolu
// Bu dosyayı Firebase konsolundan indirdiniz ve GÜVENLİ BİR YERDE SAKLAMALISINIZ.
const serviceAccount = require('./rota1-d40e4-firebase-adminsdk-fbsvc-85b551fde2.json'); 

// Firebase Admin SDK'yı başlat
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const firestore = admin.firestore();

async function createUser(email, password, displayName) {
  try {
    // Firebase Authentication'da kullanıcı oluştur
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName,
    });

    console.log('Firebase Auth kullanıcısı oluşturuldu:', userRecord.uid);

    // Firestore'da kullanıcı profili oluştur
    await firestore.collection('users').doc(userRecord.uid).set({
      name: displayName,
      email: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: userRecord.uid // Kullanıcının kendi ownerId'si olarak UID'sini ayarla
    });

    console.log('Firestore profili oluşturuldu:', userRecord.uid);
    console.log('Kullanıcı başarıyla oluşturuldu:', email);
    return userRecord;

  } catch (error) {
    console.error('Kullanıcı oluşturulurken hata oluştu:', error.message);
    throw error;
  }
}

// Komut satırı argümanlarını al
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Kullanım: node create_user_cli.js <email> <password> <displayName>');
  process.exit(1);
}

const email = args[0];
const password = args[1];
const displayName = args[2];

createUser(email, password, displayName)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
