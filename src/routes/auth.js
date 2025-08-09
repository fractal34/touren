const express = require('express');
const { admin, db } = require('../config/firebase'); // db'yi de import et
const router = express.Router();

// Middleware to decode token and attach user to request
const decodeIDToken = async (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken;
            return next();
        } catch (err) {
            console.error('Error while verifying ID token:', err);
            return res.status(401).send('Unauthorized');
        }
    }
    return res.status(401).send('Unauthorized');
};

// YENİ: Kullanıcı profilini Firestore'a kaydeden API ucu
router.post('/create-profile', decodeIDToken, async (req, res) => {
    const { name } = req.body;
    const user = req.user; // Token'dan gelen kullanıcı bilgisi

    if (!name) {
        return res.status(400).json({ message: 'İsim alanı zorunludur.' });
    }

    try {
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: user.email,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(201).json({ message: 'Profil başarıyla oluşturuldu!' });
    } catch (error) {
        console.error('Firestore profil oluşturma hatası:', error);
        res.status(500).json({ message: 'Profil oluşturulurken bir hata oluştu.' });
    }
});

// GÜNCELLENDİ: Giriş yapıldığında token'ı doğrulayan ve kullanıcı adını döndüren API ucu
router.post('/verify-token', decodeIDToken, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        const userData = userDoc.data();
        
        res.status(200).json({ 
            message: 'Giriş başarılı!', 
            user: {
                uid: req.user.uid,
                name: userData ? userData.name : req.user.name, // Firestore'da varsa oradan, yoksa token'dan al
                email: req.user.email
            }
        });
    } catch (error) {
        console.error('Token doğrulama veya kullanıcı verisi alma hatası:', error);
        res.status(401).json({ message: 'Geçersiz token veya kullanıcı verisi alınamadı.' });
    }
});

// YENİ: Kullanıcı profilini güncelleyen API ucu
router.put('/update-profile', decodeIDToken, async (req, res) => {
    const { name } = req.body;
    const user = req.user; // Token'dan gelen kullanıcı bilgisi

    if (!name) {
        return res.status(400).json({ message: 'İsim alanı boş bırakılamaz.' });
    }

    try {
        await db.collection('users').doc(user.uid).update({
            name: name,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(200).json({ message: 'Profil başarıyla güncellendi!' });
    } catch (error) {
        console.error('Firestore profil güncelleme hatası:', error);
        res.status(500).json({ message: 'Profil güncellenirken bir hata oluştu.' });
    }
});

module.exports = router;