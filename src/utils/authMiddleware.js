const { admin } = require('../config/firebase');

const authMiddleware = async (req, res, next) => {
  console.log('authMiddleware: İstek geldi.');
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('authMiddleware: Yetkilendirme tokeni bulunamadı veya formatı yanlış.');
    return res.status(401).json({ message: 'Yetkilendirme tokeni bulunamadı veya formatı yanlış.' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  console.log('authMiddleware: Token alındı, doğrulama başlatılıyor...');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // { uid, email, etc. }
    console.log('authMiddleware: Token başarıyla doğrulandı. UID:', req.user.uid);
    next();
  } catch (error) {
    console.error('authMiddleware: Token doğrulama hatası:', error);
    return res.status(403).json({ message: 'Geçersiz veya süresi dolmuş token.', details: error.message });
  }
};

module.exports = authMiddleware;
