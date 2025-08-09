const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../utils/authMiddleware');

// Kullanıcıya ait tüm özel alanları getir
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.uid;
        const snapshot = await db.collection('users').doc(userId).collection('custom_fields').orderBy('createdAt').get();
        const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(fields);
    } catch (error) {
        console.error("Kullanıcıya özel alanlar getirilirken hata:", error);
        res.status(500).json({ message: "Özel alanlar getirilirken bir sunucu hatası oluştu." });
    }
});

// Kullanıcı için yeni bir özel alan ekle
router.post('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { label } = req.body;
        if (!label) {
            return res.status(400).json({ message: 'Alan etiketi (label) zorunludur.' });
        }

        const fieldId = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        const userCustomFieldsRef = db.collection('users').doc(userId).collection('custom_fields');

        const existingField = await userCustomFieldsRef.where('fieldId', '==', fieldId).get();
        if (!existingField.empty) {
            return res.status(409).json({ message: 'Bu alan zaten mevcut.' });
        }

        const newField = {
            label,
            fieldId,
            createdAt: new Date()
        };

        const docRef = await userCustomFieldsRef.add(newField);
        res.status(201).json({ id: docRef.id, ...newField });
    } catch (error) {
        console.error("Kullanıcıya özel alan eklenirken hata:", error);
        res.status(500).json({ message: "Özel alan eklenirken bir sunucu hatası oluştu." });
    }
});

// Kullanıcıya ait bir özel alanı güncelle
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.uid;
        const fieldDocId = req.params.id;
        const { label } = req.body;
        if (!label) {
            return res.status(400).json({ message: 'Alan etiketi (label) zorunludur.' });
        }

        const fieldRef = db.collection('users').doc(userId).collection('custom_fields').doc(fieldDocId);
        await fieldRef.update({ label });

        res.status(200).json({ message: 'Özel alan başarıyla güncellendi.', id: fieldDocId, label });
    } catch (error) {
        console.error("Kullanıcıya özel alan güncellenirken hata:", error);
        res.status(500).json({ message: "Özel alan güncellenirken bir sunucu hatası oluştu." });
    }
});

// Kullanıcıya ait bir özel alanı sil
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.uid;
        const fieldId = req.params.id;
        await db.collection('users').doc(userId).collection('custom_fields').doc(fieldId).delete();
        res.status(200).json({ message: 'Özel alan başarıyla silindi.' });
    } catch (error) {
        console.error("Kullanıcıya özel alan silinirken hata:", error);
        res.status(500).json({ message: "Özel alan silinirken bir sunucu hatası oluştu." });
    }
});

module.exports = router;
