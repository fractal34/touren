const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { db } = require('../config/firebase');
const authMiddleware = require('../utils/authMiddleware');
const { geocodeAddress } = require('../utils/geoHelpers');

const upload = multer({ storage: multer.memoryStorage() });

// Kullanıcıya ait tüm marketleri getir
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('markets').where('ownerId', '==', userId).get();
    let markets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by city then by name in memory
    markets.sort((a, b) => {
      const cityA = a.addressDetails.city || '';
      const cityB = b.addressDetails.city || '';
      const nameA = a.name || '';
      const nameB = b.name || '';

      if (cityA < cityB) return -1;
      if (cityA > cityB) return 1;
      return nameA.localeCompare(nameB);
    });

    res.status(200).json(markets);
  } catch (error) {
    console.error("Kullanıcıya ait marketler getirilirken hata:", error);
    res.status(500).json({ message: "Marketler getirilirken bir sunucu hatası oluştu." });
  }
});

// Kullanıcıya ait yeni market ekle
router.post('/', authMiddleware, async (req, res) => {
    const userId = req.user.uid;
    const { name, customerNumber, address, coordinates, notes, specialNotes, customFieldValues, euroPalletKg, widePalletKg } = req.body;

    if (!name || !address || !address.street || !address.zip || !address.city) {
        return res.status(400).json({ message: "Market adı ve tam adres (sokak, posta kodu, şehir) zorunludur." });
    }

    try {
        let marketCoordinates = coordinates;
        if (!marketCoordinates || !marketCoordinates.lat || !marketCoordinates.lng) {
            const fullAddress = `${address.street} ${address.number || ''}, ${address.zip} ${address.city}, ${address.country || 'Almanya'}`.trim();
            marketCoordinates = await geocodeAddress(fullAddress);
        }

        if (!marketCoordinates || !marketCoordinates.lat || !marketCoordinates.lng) {
            return res.status(400).json({ message: "Market adresi için koordinatlar bulunamadı." });
        }

        const newMarket = {
            ownerId: userId, // <<< KULLANICI ID'Sİ EKLENDİ
            name,
            customerNumber: customerNumber || '',
            address: `${address.street} ${address.number || ''}, ${address.zip} ${address.city}`.trim(),
            addressDetails: address,
            notes: notes || '',
            specialNotes: specialNotes || '',
            euroPalletKg: euroPalletKg || 0,
            widePalletKg: widePalletKg || 0,
            customFieldValues: customFieldValues || {},
            coordinates: marketCoordinates,
            createdAt: new Date()
        };

        const docRef = await db.collection('markets').add(newMarket);
        res.status(201).json({ id: docRef.id, ...newMarket });
    } catch (error) {
        console.error("Market eklenirken hata oluştu:", error);
        res.status(500).json({ message: "Market eklenirken bir sunucu hatası oluştu." });
    }
});

// Kullanıcıya ait bir marketi güncelle
router.put('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.uid;
    const marketId = req.params.id;
    const { name, customerNumber, address, coordinates, notes, specialNotes, customFieldValues, euroPalletKg, widePalletKg } = req.body;

    if (!name || !address || !address.street || !address.zip || !address.city) {
        return res.status(400).json({ message: "Market adı ve tam adres (sokak, posta kodu, şehir) zorunludur." });
    }

    try {
        const marketRef = db.collection('markets').doc(marketId);
        const marketDoc = await marketRef.get();

        if (!marketDoc.exists) {
            return res.status(404).json({ message: "Güncellenecek market bulunamadı." });
        }

        const existingMarket = marketDoc.data();
        if (existingMarket.ownerId !== userId) {
            return res.status(403).json({ message: "Bu marketi güncelleme yetkiniz yok." });
        }

        let marketCoordinates = coordinates;
        const addressChanged = (
            existingMarket.addressDetails.street !== address.street ||
            existingMarket.addressDetails.number !== address.number ||
            existingMarket.addressDetails.zip !== address.zip ||
            existingMarket.addressDetails.city !== address.city
        );

        if ((!marketCoordinates || !marketCoordinates.lat || !marketCoordinates.lng) && addressChanged) {
            const fullAddress = `${address.street} ${address.number || ''}, ${address.zip} ${address.city}, ${address.country || 'Almanya'}`.trim();
            marketCoordinates = await geocodeAddress(fullAddress);
        } else {
            marketCoordinates = existingMarket.coordinates;
        }

        if (!marketCoordinates || !marketCoordinates.lat || !marketCoordinates.lng) {
            return res.status(400).json({ message: "Market adresi için koordinatlar bulunamadı." });
        }

        const updatedMarket = {
            name,
            customerNumber: customerNumber || '',
            address: `${address.street} ${address.number || ''}, ${address.zip} ${address.city}`.trim(),
            addressDetails: address,
            notes: notes || '',
            specialNotes: specialNotes || '',
            euroPalletKg: euroPalletKg || 0,
            widePalletKg: widePalletKg || 0,
            customFieldValues: customFieldValues || {},
            coordinates: marketCoordinates,
            updatedAt: new Date()
        };

        await marketRef.set(updatedMarket, { merge: true });
        res.status(200).json({ id: marketId, ...updatedMarket });
    } catch (error) {
        console.error(`Market ${marketId} güncellenirken hata oluştu:`, error);
        res.status(500).json({ message: "Market güncellenirken bir sunucu hatası oluştu." });
    }
});

// Kullanıcıya ait bir marketi sil
router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = req.user.uid;
    const marketId = req.params.id;
    try {
        const marketRef = db.collection('markets').doc(marketId);
        const marketDoc = await marketRef.get();

        if (!marketDoc.exists) {
            return res.status(404).json({ message: "Silinecek market bulunamadı." });
        }

        if (marketDoc.data().ownerId !== userId) {
            return res.status(403).json({ message: "Bu marketi silme yetkiniz yok." });
        }

        await marketRef.delete();
        res.status(200).json({ message: "Market başarıyla silindi." });
    } catch (error) {
        console.error(`Market ${marketId} silinirken hata oluştu:`, error);
        res.status(500).json({ message: "Market silinirken bir sunucu hatası oluştu." });
    }
});

// Kullanıcıya ait marketlerden şehir listesi oluştur
router.get('/cities', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.uid;
        const snapshot = await db.collection('markets').where('ownerId', '==', userId).get();
        const cities = new Set();
        snapshot.docs.forEach(doc => {
            if (doc.data().addressDetails && doc.data().addressDetails.city) {
                cities.add(doc.data().addressDetails.city);
            }
        });
        res.status(200).json([...cities].sort());
    } catch (error) {
        console.error("Kullanıcıya ait şehirler getirilirken hata:", error);
        res.status(500).json({ message: "Şehirler getirilirken bir sunucu hatası oluştu." });
    }
});


// Excel'den market yükleme
router.post('/upload-excel', authMiddleware, upload.single('excelFile'), async (req, res) => {
    const userId = req.user.uid;
    if (!req.file) {
        return res.status(400).json({ message: "Lütfen bir Excel dosyası yükleyin." });
    }

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);

        const results = {
            success: [],
            failed: []
        };

        for (const row of jsonData) {
            const marketName = row['market ismi'] || row['Market İsmi'];
            const customerName = row['müşteri ismi'] || row['Müşteri İsmi'] || row['müşteri numarası'] || row['Müşteri Numarası'] || '';
            const address = row['adres'] || row['Adres'];

            if (!marketName || !address) {
                results.failed.push({ row: row, reason: "Market ismi veya adres eksik." });
                continue;
            }

            try {
                // Adresi parçalama ve geocoding
                // Basit bir ayrıştırma yapıyoruz, daha karmaşık adresler için iyileştirme gerekebilir.
                // Örnek: "Sokak Adı 123, 12345 Şehir, Ülke"
                // Adres içindeki sokak ve numarayı ayırmak için regex
                const streetRegex = /^(.*?)\s*(\d+\s*[a-zA-Z]?)$/;
                const streetMatch = address.match(streetRegex);

                let streetForGeocoding = address;
                if (streetMatch) {
                    streetForGeocoding = `${streetMatch[1].trim()} ${streetMatch[2].trim()}`;
                }

                const geocodeResult = await geocodeAddress(streetForGeocoding);

                if (!geocodeResult || !geocodeResult.lat || !geocodeResult.lng) {
                    results.failed.push({ row: row, reason: `Adres için koordinatlar bulunamadı: ${streetForGeocoding}` });
                    continue;
                }

                const newMarket = {
                    ownerId: userId,
                    name: marketName,
                    customerNumber: customerName,
                    address: geocodeResult.fullAddress, 
                    addressDetails: {
                        street: geocodeResult.street || (streetMatch ? streetMatch[1].trim() : ''),
                        number: geocodeResult.houseNumber || (streetMatch ? streetMatch[2].trim() : ''),
                        zip: geocodeResult.postalCode,
                        city: geocodeResult.city,
                        country: geocodeResult.country || 'Almanya'
                    },
                    notes: '',
                    specialNotes: '',
                    euroPalletKg: 0,
                    widePalletKg: 0,
                    customFieldValues: {},
                    coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng },
                    createdAt: new Date()
                };

                await db.collection('markets').add(newMarket);
                results.success.push(row);
            } catch (error) {
                console.error("Market işlenirken hata:", row, error);
                results.failed.push({ row: row, reason: `Sunucu hatası: ${error.message}` });
            }
        }

        res.status(200).json({
            message: "Excel yükleme tamamlandı.",
            summary: `${results.success.length} market başarıyla eklendi, ${results.failed.length} market hata verdi.`,
            results: results
        });

    } catch (error) {
        console.error("Excel dosyası işlenirken hata:", error);
        res.status(500).json({ message: "Excel dosyası işlenirken bir sunucu hatası oluştu." });
    }
});

// Dışarıdan market ekleme (isme göre)
router.post('/add-by-name', authMiddleware, async (req, res) => {
    const userId = req.user.uid;
    const { marketName, location } = req.body;

    if (!marketName || !location) {
        return res.status(400).json({ message: "Market adı ve konum (şehir/posta kodu) zorunludur." });
    }

    const searchQuery = `${marketName}, ${location}`;

    try {
        const geocodeResult = await geocodeAddress(searchQuery);

        if (!geocodeResult || !geocodeResult.lat || !geocodeResult.lng) {
            return res.status(404).json({ message: `"${searchQuery}" için adres bulunamadı.` });
        }

        const newMarket = {
            ownerId: userId,
            name: marketName, // Kullanıcının girdiği orijinal ismi koru
            customerNumber: '', // Bu akışta müşteri numarası yok
            address: geocodeResult.fullAddress,
            addressDetails: {
                street: geocodeResult.street || '',
                number: geocodeResult.houseNumber || '',
                zip: geocodeResult.postalCode,
                city: geocodeResult.city,
                country: geocodeResult.country || 'Almanya'
            },
            notes: '',
            specialNotes: '',
            euroPalletKg: 0,
            widePalletKg: 0,
            customFieldValues: {},
            coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng },
            createdAt: new Date()
        };

        const docRef = await db.collection('markets').add(newMarket);
        res.status(201).json({ id: docRef.id, ...newMarket });

    } catch (error) {
        console.error(`'${searchQuery}' için market eklenirken hata:`, error);
        res.status(500).json({ message: "Market eklenirken bir sunucu hatası oluştu." });
    }
});

module.exports = router;

