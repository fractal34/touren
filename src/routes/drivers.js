const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../utils/authMiddleware');
const { geocodeAddress } = require('../utils/geoHelpers');

// Kullanıcıya ait şoförleri listele
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('drivers').where('ownerId', '==', userId).get();
    const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(drivers);
  } catch (error) {
    console.error("Şoförler getirilirken hata:", error);
    res.status(500).json({ message: "Şoförler getirilirken bir hata oluştu." });
  }
});

// Kullanıcı için yeni şoför ekle
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const { name, licensePlate, maxPallets, palletCapacity, fixedStartAddress, fixedEndAddress } = req.body;

  if (!name || !licensePlate || !maxPallets || !palletCapacity || !fixedStartAddress || !fixedEndAddress) {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }

  try {
    const fixedStartCoordinates = await geocodeAddress(fixedStartAddress);
    const fixedEndCoordinates = await geocodeAddress(fixedEndAddress);

    if (!fixedStartCoordinates || !fixedEndCoordinates) {
      return res.status(400).json({ message: "Başlangıç veya bitiş adresi için koordinatlar bulunamadı." });
    }

    const newDriver = {
      ownerId: userId, // <<< KULLANICI ID'Sİ EKLENDİ
      name,
      licensePlate,
      maxPallets: parseInt(maxPallets, 10),
      palletCapacity: parseInt(palletCapacity, 10),
      fixedStart: { address: fixedStartAddress, coordinates: fixedStartCoordinates },
      fixedEnd: { address: fixedEndAddress, coordinates: fixedEndCoordinates },
      createdAt: new Date()
    };

    const docRef = await db.collection('drivers').add(newDriver);
    res.status(201).json({ id: docRef.id, ...newDriver });
  } catch (error) {
    console.error("Şoför eklenirken hata:", error);
    res.status(500).json({ message: "Şoför eklenirken bir hata oluştu." });
  }
});

// Kullanıcıya ait bir şoförü güncelle
router.put('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const driverId = req.params.id;
  const { name, licensePlate, maxPallets, palletCapacity, fixedStartAddress, fixedEndAddress } = req.body;

  if (!name || !licensePlate || !maxPallets || !palletCapacity || !fixedStartAddress || !fixedEndAddress) {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }

  try {
    const driverRef = db.collection('drivers').doc(driverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
        return res.status(404).json({ message: "Güncellenecek şoför bulunamadı." });
    }

    if (driverDoc.data().ownerId !== userId) {
        return res.status(403).json({ message: "Bu şoförü güncelleme yetkiniz yok." });
    }

    const fixedStartCoordinates = await geocodeAddress(fixedStartAddress);
    const fixedEndCoordinates = await geocodeAddress(fixedEndAddress);

    if (!fixedStartCoordinates || !fixedEndCoordinates) {
      return res.status(400).json({ message: "Başlangıç veya bitiş adresi için koordinatlar bulunamadı." });
    }

    const updatedDriver = {
      name,
      licensePlate,
      maxPallets: parseInt(maxPallets, 10),
      palletCapacity: parseInt(palletCapacity, 10),
      fixedStart: { address: fixedStartAddress, coordinates: fixedStartCoordinates },
      fixedEnd: { address: fixedEndAddress, coordinates: fixedEndCoordinates },
      updatedAt: new Date()
    };

    await driverRef.set(updatedDriver, { merge: true });
    res.status(200).json({ id: driverId, ...updatedDriver });
  } catch (error) {
    console.error("Şoför güncellenirken hata:", error);
    res.status(500).json({ message: "Şoför güncellenirken bir hata oluştu." });
  }
});

// Kullanıcıya ait bir şoförü sil
router.delete('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const driverId = req.params.id;
  try {
    const driverRef = db.collection('drivers').doc(driverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
        return res.status(404).json({ message: "Silinecek şoför bulunamadı." });
    }

    if (driverDoc.data().ownerId !== userId) {
        return res.status(403).json({ message: "Bu şoförü silme yetkiniz yok." });
    }

    await driverRef.delete();
    res.status(200).json({ message: "Şoför başarıyla silindi." });
  } catch (error) {
    console.error("Şoför silinirken hata:", error);
    res.status(500).json({ message: "Şoför silinirken bir hata oluştu." });
  }
});

module.exports = router;
