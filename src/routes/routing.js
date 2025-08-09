const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { db } = require('../config/firebase');
const { geocodeAddress, calculateHaversineDistance } = require('../utils/geoHelpers');
const { solveTSPForTruck } = require('../utils/tspSolver');
const authMiddleware = require('../utils/authMiddleware'); // authMiddleware'i dahil et

const HERE_API_KEY = process.env.HERE_API_KEY || 'rnWVc4gACUg-4DhRlWTVainI7ihE6tx1vcHTMhdqXuI'; // API anahtarınızı buraya ekleyin veya .env kullanın

// KAMYON ROTA OPTİMİZASYONU - HERE Routing API v8 ile kendi matrix oluşturma
router.post('/optimize-route', async (req, res) => {
  try { // <--- BÜYÜK TRY-CATCH BAŞLANGICI
    const { origin, destination, viaPoints, truckSpecs } = req.body;
    console.log("Gelen Rota İsteği:", { origin, destination, viaPoints, truckSpecs });

    if (!origin || !destination || !viaPoints || !viaPoints.length) {
      return res.status(400).json({ message: 'Başlangıç, bitiş ve en az bir ara nokta gereklidir.' });
    }

    const [originLat, originLng] = origin.split(',').map(parseFloat);
    const [destLat, destLng] = destination.split(',').map(parseFloat);

    // Gelen viaPoints verisini (ID'li) ve başlangıç/bitiş noktalarını birleştir
    const allWaypoints = [
        { lat: originLat, lng: originLng, id: 'start' },
        ...viaPoints, // viaPoints zaten {id, lat, lng} formatında geliyor
        { lat: destLat, lng: destLng, id: 'end' }
    ];

    const waypointObjects = allWaypoints.map((point, index) => ({
        ...point,
        originalIndex: index
    }));

    console.log("Waypoint nesneleri:", waypointObjects);

    // Kendi distance matrix'imizi oluşturalım
    const distanceMatrix = [];
    
    for (let i = 0; i < waypointObjects.length; i++) {
      distanceMatrix[i] = { travelTimes: [], distances: [] };
      
      for (let j = 0; j < waypointObjects.length; j++) {
        if (i === j) {
          // Aynı nokta
          distanceMatrix[i].travelTimes[j] = 0;
          distanceMatrix[i].distances[j] = 0;
        } else {
          // HERE Routing API ile mesafe hesapla
          const routeParams = new URLSearchParams({
            transportMode: 'truck',
            origin: `${waypointObjects[i].lat},${waypointObjects[i].lng}`,
            destination: `${waypointObjects[j].lat},${waypointObjects[j].lng}`,
            return: 'summary',
            apikey: HERE_API_KEY
          });

          // Kamyon özelliklerini ekle
          if (truckSpecs) {
            if (truckSpecs.maxWeight) routeParams.append('truck[grossWeight]', truckSpecs.maxWeight);
            if (truckSpecs.height) routeParams.append('truck[height]', truckSpecs.height / 100);
            if (truckSpecs.width) routeParams.append('truck[width]', truckSpecs.width / 100);
            if (truckSpecs.length) routeParams.append('truck[length]', truckSpecs.length / 100);
          }

          try {
            const routeUrl = `https://router.hereapi.com/v8/routes?${routeParams.toString()}`;
            const routeResponse = await fetch(routeUrl);
            const routeData = await routeResponse.json();

            if (routeResponse.ok && routeData.routes && routeData.routes.length > 0) {
              const summary = routeData.routes[0].sections[0].summary;
              distanceMatrix[i].travelTimes[j] = summary.duration;
              distanceMatrix[i].distances[j] = summary.length;
            } else {
              console.warn(`Rota hesaplanamadı: ${i} -> ${j}`);
              // Fallback: Haversine distance
              const distance = calculateHaversineDistance(
                waypointObjects[i].lat, waypointObjects[i].lng,
                waypointObjects[j].lat, waypointObjects[j].lng
              );
              distanceMatrix[i].travelTimes[j] = distance / 50 * 3600; // ~50km/h ortalama
              distanceMatrix[i].distances[j] = distance * 1000; // km -> m
            }
          } catch (error) {
            console.warn(`Routing hatası ${i} -> ${j}:`, error.message);
            // Fallback distance
            const distance = calculateHaversineDistance(
              waypointObjects[i].lat, waypointObjects[i].lng,
              waypointObjects[j].lat, waypointObjects[j].lng
            );
            distanceMatrix[i].travelTimes[j] = distance / 50 * 3600;
            distanceMatrix[i].distances[j] = distance * 1000;
          }
          
          // Rate limiting için kısa bekleme
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    console.log("Distance matrix oluşturuldu");

    // Distance matrix'i debug için logla
    console.log("Distance matrix boyutu:", distanceMatrix.length);
    for (let i = 0; i < Math.min(distanceMatrix.length, 3); i++) {
      console.log(`Matrix[${i}]:`, {
        travelTimes: distanceMatrix[i].travelTimes.slice(0, 3),
        distances: distanceMatrix[i].distances.slice(0, 3)
      });
    }

    // TSP algoritması ile optimize et
    console.log("TSP algoritması başlatılıyor...");
    const optimizedSequence = solveTSPForTruck(waypointObjects, distanceMatrix);
    console.log("TSP tamamlandı:", optimizedSequence.length, "nokta");
    
    // Toplam mesafe ve süre hesapla
    let totalDistance = 0;
    let totalTime = 0;
    console.log("Toplam mesafe/süre hesaplaması başlıyor...");

    for (let i = 0; i < optimizedSequence.length - 1; i++) {
      console.log(`Döngü adımı i = ${i}`);
      const fromPoint = optimizedSequence[i];
      const toPoint = optimizedSequence[i + 1];

      if (!fromPoint || !toPoint) {
        console.error(`Hata: fromPoint veya toPoint tanımsız! i=${i}`);
        continue;
      }
      console.log(`From: ${fromPoint.lat},${fromPoint.lng} -> To: ${toPoint.lat},${toPoint.lng}`);

      const fromIndex = waypointObjects.findIndex(wp =>
        wp.lat === fromPoint.lat && wp.lng === fromPoint.lng
      );
      const toIndex = waypointObjects.findIndex(wp =>
        wp.lat === toPoint.lat && wp.lng === toPoint.lng
      );
      console.log(`Indexler bulundu: fromIndex=${fromIndex}, toIndex=${toIndex}`);

      if (fromIndex !== -1 && toIndex !== -1) {
        try {
          console.log(`Matrix erişimi: distanceMatrix[${fromIndex}].distances[${toIndex}]`);
          totalDistance += distanceMatrix[fromIndex].distances[toIndex] || 0;
          totalTime += distanceMatrix[fromIndex].travelTimes[toIndex] || 0;
          console.log(`Güncel toplamlar: Mesafe=${totalDistance}, Süre=${totalTime}`);
        } catch (e) {
          console.error(`Matrix erişim hatası: fromIndex=${fromIndex}, toIndex=${toIndex}`, e.message);
        }
      } else {
        console.warn("Uyarı: fromIndex veya toIndex bulunamadı.");
      }
    }
    console.log("Toplam mesafe/süre hesaplaması tamamlandı.");

    const responseObject = {
      success: true,
      optimizedSequence,
      summary: {
        totalDistance: Math.round(totalDistance), // metre
        totalTime: Math.round(totalTime), // saniye
        totalDistanceKm: Math.round(totalDistance / 1000 * 100) / 100, // km
        totalTimeHours: Math.round(totalTime / 3600 * 100) / 100 // saat
      }
    };

    console.log("Yanıt gönderilmeden önce son kontrol:", JSON.stringify(responseObject, null, 2));

    res.status(200).json(responseObject);

  } catch (error) {
    console.error("!!! KRİTİK HATA - Rota Optimizasyonu Ana Bloğunda Yakalandı !!!:", error);
    res.status(500).json({ 
      success: false,
      message: 'Sunucuda beklenmedik bir hata oluştu.', 
      error: error.message,
      stack: error.stack // Hatanın yığın izini de gönderelim
    });
  } // <--- BÜYÜK TRY-CATCH SONU
});

// Optimize edilmiş rota için detaylı yol tarifi al
router.post('/detailed-route', async (req, res) => {
  const { waypoints, truckSpecs } = req.body;
  console.log("Detailed Route Request - Waypoints:", waypoints);
  
  if (!waypoints || waypoints.length < 2) {
    return res.status(400).json({ message: 'En az 2 waypoint gereklidir.' });
  }

  try {
    // HERE Routing API v8 için parametreler
    const routeParams = new URLSearchParams({
      transportMode: 'truck',
      origin: `${waypoints[0].lat},${waypoints[0].lng}`,
      destination: `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`,
      return: 'summary,polyline,actions,routeHandle',
      apikey: HERE_API_KEY
    });

    // Ara noktalar varsa via olarak ekle
    if (waypoints.length > 2) {
      waypoints.slice(1, -1).forEach(point => {
        routeParams.append('via', `${point.lat},${point.lng}`);
      });
    }

    // Kamyon özelliklerini ekle
    if (truckSpecs) {
      if (truckSpecs.maxWeight) routeParams.append('truck[grossWeight]', truckSpecs.maxWeight);
      if (truckSpecs.height) routeParams.append('truck[height]', truckSpecs.height / 100); // cm -> m
      if (truckSpecs.width) routeParams.append('truck[width]', truckSpecs.width / 100); // cm -> m
      if (truckSpecs.length) routeParams.append('truck[length]', truckSpecs.length / 100); // cm -> m
      if (truckSpecs.axleWeight) routeParams.append('truck[axleWeight]', truckSpecs.axleWeight);
      if (truckSpecs.hazardousGoods) routeParams.append('truck[hazardousGoods]', truckSpecs.hazardousGoods.join(','));
    }

    const routeUrl = `https://router.hereapi.com/v8/routes?${routeParams.toString()}`;
    console.log("Detaylı rota URL:", routeUrl);
    
    const response = await fetch(routeUrl);
    const data = await response.json();
    console.log("HERE API Detailed Route Response:", JSON.stringify(data, null, 2));

    if (response.ok && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      res.status(200).json({
        success: true,
        route: {
          summary: route.sections[0].summary,
          polylines: route.sections.map(section => section.polyline),
          instructions: route.sections[0].actions || [],
          routeHandle: route.routeHandle
        }
      });
    } else {
      console.error("Routing API Hatası:", data);
      res.status(response.status || 400).json({
        success: false,
        message: 'Detaylı rota hesaplaması başarısız oldu.',
        details: data
      });
    }

  } catch (error) {
    console.error("Detaylı Routing Sunucu Hatası:", error);
    res.status(500).json({ 
      success: false,
      message: 'Sunucu hatası: Detaylı rota hesaplanamadı.', 
      error: error.message 
    });
  }
});

// Rotaları listele
router.get('/routes', authMiddleware, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const routesRef = db.collection('kayitli_rotalar').where('ownerId', '==', ownerId);
        const snapshot = await routesRef.orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const routes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(routes);
    } catch (error) {
        console.error("Rotalar listelenirken hata:", error);
        res.status(500).json({ message: 'Rotalar alınamadı.', error: error.message, stack: error.stack });
    }
});

// Tek bir rotayı getir (düzenleme için)
router.get('/routes/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.user.uid;
        const doc = await db.collection('kayitli_rotalar').doc(id).get();

        if (!doc.exists || doc.data().ownerId !== ownerId) {
            return res.status(404).json({ message: 'Rota bulunamadı veya erişim izniniz yok.' });
        }

        const routeData = doc.data();

        // --- SAĞLAMLIK KONTROLÜ ve VERİ ZENGİNLEŞTİRME ---
        // Eğer rotanın kendi başlangıç/bitiş noktaları yoksa (eski kayıt olabilir),
        // rotaya atanmış şoförün sabit adreslerini varsayılan olarak kullan.
        if (!routeData.startPoint || !routeData.endPoint) {
            if (routeData.driverId) {
                try {
                    const driverDoc = await db.collection('drivers').doc(routeData.driverId).get();
                    if (driverDoc.exists) {
                        const driverData = driverDoc.data();
                        // Sadece eksik olan alanı doldur
                        if (!routeData.startPoint && driverData.fixedStart && driverData.fixedStart.coordinates) {
                            routeData.startPoint = `${driverData.fixedStart.coordinates.lat},${driverData.fixedStart.coordinates.lng}`;
                        }
                        if (!routeData.endPoint && driverData.fixedEnd && driverData.fixedEnd.coordinates) {
                            routeData.endPoint = `${driverData.fixedEnd.coordinates.lat},${driverData.fixedEnd.coordinates.lng}`;
                        }
                    }
                } catch (driverError) {
                    console.error(`Şoför [${routeData.driverId}] verisi alınırken hata oluştu:`, driverError);
                }
            }
        }

        res.status(200).json({ id: doc.id, ...routeData });
    } catch (error) {
        console.error("Rota getirilirken hata:", error);
        res.status(500).json({ message: 'Rota alınamadı.', error: error.message });
    }
});

// Rotayı güncelle
router.put('/routes/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const ownerId = req.user.uid;
    try {
        const routeRef = db.collection('kayitli_rotalar').doc(id);
        const doc = await routeRef.get();

        if (!doc.exists || doc.data().ownerId !== ownerId) {
            return res.status(404).json({ message: 'Rota bulunamadı veya erişim izniniz yok.' });
        }

        const { routeName, driverId, startPoint, endPoint, truckWeight, truckPalletCapacity, stops } = req.body;

        if (!routeName || !startPoint || !endPoint || !stops || stops.length < 2) {
            return res.status(400).json({ message: "Rota adı, başlangıç, bitiş ve en az iki durak noktası zorunludur." });
        }

        // 1. Rota optimizasyonunu yeniden yap
        const [originLat, originLng] = startPoint.split(',').map(parseFloat);
        const [destLat, destLng] = endPoint.split(',').map(parseFloat);

        const viaPointsData = stops.filter(s => s.id !== 'start' && s.id !== 'end').map(s => ({
            id: s.id,
            lat: s.lat,
            lng: s.lng
        }));

        const allWaypoints = [
            { lat: originLat, lng: originLng, id: 'start' },
            ...viaPointsData,
            { lat: destLat, lng: destLng, id: 'end' }
        ];

        const waypointObjects = allWaypoints.map((point, index) => ({
            ...point,
            originalIndex: index
        }));

        const distanceMatrix = [];
        for (let i = 0; i < waypointObjects.length; i++) {
            distanceMatrix[i] = { travelTimes: [], distances: [] };
            for (let j = 0; j < waypointObjects.length; j++) {
                if (i === j) {
                    distanceMatrix[i].travelTimes[j] = 0;
                    distanceMatrix[i].distances[j] = 0;
                } else {
                    const routeParams = new URLSearchParams({
                        transportMode: 'truck',
                        origin: `${waypointObjects[i].lat},${waypointObjects[i].lng}`,
                        destination: `${waypointObjects[j].lat},${waypointObjects[j].lng}`,
                        return: 'summary',
                        apikey: HERE_API_KEY
                    });
                    if (truckWeight) routeParams.append('truck[grossWeight]', truckWeight);

                    const routeUrl = `https://router.hereapi.com/v8/routes?${routeParams.toString()}`;
                    const response = await fetch(routeUrl);
                    const data = await response.json();

                    if (response.ok && data.routes && data.routes.length > 0) {
                        const summary = data.routes[0].sections[0].summary;
                        distanceMatrix[i].travelTimes[j] = summary.duration;
                        distanceMatrix[i].distances[j] = summary.length;
                    } else {
                        const distance = calculateHaversineDistance(
                            waypointObjects[i].lat, waypointObjects[i].lng,
                            waypointObjects[j].lat, waypointObjects[j].lng
                        );
                        distanceMatrix[i].travelTimes[j] = distance / 50 * 3600;
                        distanceMatrix[i].distances[j] = distance * 1000;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
                }
            }
        }

        const optimizedSequence = solveTSPForTruck(waypointObjects, distanceMatrix);

        let totalDistance = 0;
        let totalTime = 0;
        for (let i = 0; i < optimizedSequence.length - 1; i++) {
            const fromPoint = optimizedSequence[i];
            const toPoint = optimizedSequence[i + 1];
            const fromIndex = waypointObjects.findIndex(wp => wp.lat === fromPoint.lat && wp.lng === fromPoint.lng);
            const toIndex = waypointObjects.findIndex(wp => wp.lat === toPoint.lat && wp.lng === toPoint.lng);
            if (fromIndex !== -1 && toIndex !== -1) {
                totalDistance += distanceMatrix[fromIndex].distances[toIndex] || 0;
                totalTime += distanceMatrix[fromIndex].travelTimes[toIndex] || 0;
            }
        }

        const summary = {
            totalDistance: Math.round(totalDistance),
            totalTime: Math.round(totalTime),
            totalDistanceKm: Math.round(totalDistance / 1000 * 100) / 100,
            totalTimeHours: Math.round(totalTime / 3600 * 100) / 100
        };

        // 2. Detaylı rota bilgisini (polyline) al
        const detailedRouteParams = new URLSearchParams({
            transportMode: 'truck',
            origin: `${optimizedSequence[0].lat},${optimizedSequence[0].lng}`,
            destination: `${optimizedSequence[optimizedSequence.length - 1].lat},${optimizedSequence[optimizedSequence.length - 1].lng}`,
            return: 'polyline,summary',
            apikey: HERE_API_KEY
        });

        if (optimizedSequence.length > 2) {
            optimizedSequence.slice(1, -1).forEach(point => {
                detailedRouteParams.append('via', `${point.lat},${point.lng}`); // Hata düzeltildi: point.lng olmalı
            });
        }

        if (truckWeight) {
            detailedRouteParams.append('truck[grossWeight]', truckWeight);
        }

        const detailedRouteUrl = `https://router.hereapi.com/v8/routes?${detailedRouteParams.toString()}`;
        const detailedResponse = await fetch(detailedRouteUrl);
        const detailedData = await detailedResponse.json();

        if (!detailedResponse.ok || !detailedData.routes || detailedData.routes.length === 0) {
            throw new Error("HERE API'den detaylı rota alınamadı.");
        }

        const hereRoute = detailedData.routes[0];
        const routePolyline = hereRoute.sections.map(section => section.polyline);

        // --- YENİ: Güncelleme için Şehir Hashtag'lerini Oluşturma ---
        let cityHashtags = [];
        const marketIds = optimizedSequence
            .map(stop => stop.id)
            .filter(id => id && id !== 'start' && id !== 'end');

        if (marketIds.length > 0) {
            try {
                const marketsRef = db.collection('markets');
                const marketsSnapshot = await marketsRef.where(require('firebase-admin').firestore.FieldPath.documentId(), 'in', marketIds).get();
                
                const cities = marketsSnapshot.docs.map(doc => {
                    const marketData = doc.data();
                    return marketData.addressDetails ? marketData.addressDetails.city : null;
                }).filter(Boolean);

                const uniqueCities = [...new Set(cities)];
                cityHashtags = uniqueCities.map(city => `#${city.replace(/\s+/g, '')}`);
            } catch (e) {
                console.error("Hashtag güncellenirken market verisi alınamadı:", e);
            }
        }

        // 3. Firestore'daki rotayı güncelle
        const updatedRoute = {
            routeName,
            driverId,
            startPoint,
            endPoint,
            truckWeight,
            truckPalletCapacity, // YENİ: Palet kapasitesi eklendi
            cityHashtags, // Hashtag'leri güncelleme verisine ekle
            stops: optimizedSequence.map(optimizedStop => {
                if (optimizedStop.id === 'start' || optimizedStop.id === 'end') {
                    return optimizedStop;
                }
                const originalStop = stops.find(s => s.id === optimizedStop.id);
                return {
                    ...optimizedStop,
                    euroPallets: originalStop ? originalStop.euroPallets : 0,
                    widePallets: originalStop ? originalStop.widePallets : 0,
                    totalKg: originalStop ? originalStop.totalKg : 0,
                    notes: originalStop?.notes || '', // Notları da ekle
                };
            }),
            summary,
            hereApiResult: {
                polylines: routePolyline,
                summary: hereRoute.sections.map(s => s.summary)
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        console.log("Updating route with ID:", req.params.id);
        await db.collection('kayitli_rotalar').doc(req.params.id).update(updatedRoute);

        res.status(200).json({ 
            message: 'Rota başarıyla güncellendi.', 
            updatedRoute: { id: req.params.id, ...updatedRoute } // Güncellenmiş rotayı geri döndür
        });
    } catch (error) {
        console.error(`Rota güncellenirken hata:`, error);
        res.status(500).json({ message: 'Rota güncellenemedi.', error: error.message });
    }
});

// Rotayı sil
router.delete('/routes/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.user.uid;
        const routeRef = db.collection('kayitli_rotalar').doc(id);
        const doc = await routeRef.get();

        if (!doc.exists || doc.data().ownerId !== ownerId) {
            return res.status(404).json({ message: 'Rota bulunamadı veya erişim izniniz yok.' });
        }

        await routeRef.delete();
        res.status(200).json({ message: 'Rota başarıyla silindi.' });
    } catch (error) {
        console.error("Rota silinirken hata:", error);
        res.status(500).json({ message: 'Rota silinemedi.', error: error.message });
    }
});

// YENİ: Sadece rota sıralamasını güncelle
router.put('/routes/:id/sequence', async (req, res) => {
    try {
        const { id } = req.params;
        const { stops } = req.body; // Frontend'den gelen yeni sıralanmış durak dizisi

        if (!stops) {
            return res.status(400).json({ message: "Durak bilgileri eksik." });
        }

        const routeRef = db.collection('kayitli_rotalar').doc(id);

        // Rotanın sadece 'stops' ve 'updatedAt' alanlarını güncelle
        await routeRef.update({
            stops: stops,
            updatedAt: new Date().toISOString()
        });

        res.status(200).json({ message: 'Rota sıralaması başarıyla güncellendi.' });

    } catch (error) {
        console.error("Rota sıralaması güncellenirken hata:", error);
        res.status(500).json({ message: 'Sıralama güncellenemedi.', error: error.message });
    }
});

module.exports = router;

// Rota kaydetme ve detaylı yol tarifi alma
router.post('/detailed-route-and-save', authMiddleware, async (req, res) => {
    const { routeData } = req.body;
    const ownerId = req.user.uid; // authMiddleware'den gelen user ID'si

    if (!routeData || !routeData.stops || routeData.stops.length < 2) {
        return res.status(400).json({ message: 'Kaydedilecek geçerli rota verisi bulunamadı.' });
    }

    try {
        // 1. HERE API'den detaylı rota bilgisini (polyline) al
        const waypoints = routeData.stops;
        const routeParams = new URLSearchParams({
            transportMode: 'truck',
            origin: `${waypoints[0].lat},${waypoints[0].lng}`,
            destination: `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`,
            return: 'polyline,summary',
            apikey: HERE_API_KEY
        });

        if (waypoints.length > 2) {
            waypoints.slice(1, -1).forEach(point => {
                routeParams.append('via', `${point.lat},${point.lng}`);
            });
        }

        if (routeData.truckWeight) {
            routeParams.append('truck[grossWeight]', routeData.truckWeight);
        }

        const routeUrl = `https://router.hereapi.com/v8/routes?${routeParams.toString()}`;
        const response = await fetch(routeUrl);
        const data = await response.json();

        if (!response.ok || !data.routes || data.routes.length === 0) {
            throw new Error("HERE API'den detaylı rota alınamadı.");
        }

        const hereRoute = data.routes[0];
        const routePolyline = hereRoute.sections.map(section => section.polyline);

        // --- YENİ: Şehir Hashtag'lerini Oluşturma ---
        let cityHashtags = [];
        const marketIds = routeData.stops
            .map(stop => stop.id)
            .filter(id => id && id !== 'start' && id !== 'end');

        if (marketIds.length > 0) {
            try {
                const marketsRef = db.collection('markets');
                // Firestore 'in' sorgusu ile ilgili tüm marketleri tek seferde çek
                const marketsSnapshot = await marketsRef.where(require('firebase-admin').firestore.FieldPath.documentId(), 'in', marketIds).get();
                
                const cities = marketsSnapshot.docs.map(doc => {
                    const marketData = doc.data();
                    return marketData.addressDetails ? marketData.addressDetails.city : null;
                }).filter(Boolean); // null veya undefined olanları filtrele

                const uniqueCities = [...new Set(cities)];
                cityHashtags = uniqueCities.map(city => `#${city.replace(/\s+/g, '')}`);
            } catch (e) {
                console.error("Hashtag oluşturulurken market verisi alınamadı:", e);
                // Bu işlemin ana rota kaydını engellememesi için hata yakalıyoruz.
            }
        }

        // 2. Tüm veriyi birleştir ve Firestore'a kaydet
        const finalRouteData = {
            ...routeData,
            ownerId: ownerId, // ownerId'yi ekle
            truckPalletCapacity: routeData.truckPalletCapacity, // YENİ: Palet kapasitesi eklendi
            cityHashtags, // Oluşturulan hashtag'leri ekle
            hereApiResult: {
                polylines: routePolyline,
                summary: hereRoute.sections.map(s => s.summary)
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection('kayitli_rotalar').add(finalRouteData);

        // 3. Başarılı yanıtı ve rota bilgilerini frontend'e gönder
        res.status(200).json({
            success: true,
            message: 'Rota başarıyla kaydedildi.',
            routeId: docRef.id,
            route: {
                summary: hereRoute.sections[0].summary,
                sections: hereRoute.sections, // Tüm sectionları gönder
                stops: finalRouteData.stops // YENİ: stops verisini de ekle
            }
        });

    } catch (error) {
        console.error("Rota kaydetme ve detaylandırma hatası:", error);
        res.status(500).json({ 
            success: false,
            message: 'Sunucu hatası: Rota kaydedilemedi veya detaylandırılamadı.', 
            error: error.message 
        });
    }
});