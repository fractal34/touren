const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin SDK'sını başlat
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Gelen JSON body'lerini parse etmek için

// HERE API Key'i .env dosyasından al
const HERE_API_KEY = process.env.HERE_API_KEY || 'rnWVc4gACUg-4DhRlWTVainI7ihE6tx1vcHTMhdqXuI'; // API anahtarınızı buraya ekleyin veya .env kullanın

// Adresi koordinata çeviren yardımcı fonksiyon
async function geocodeAddress(address) {
  const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${HERE_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const position = data.items[0].position;
      return { lat: position.lat, lng: position.lng };
    } else {
      console.warn(`Adres için koordinat bulunamadı: ${address}`);
      return null;
    }
  } catch (error) {
    console.error(`Geocoding hatası ${address}:`, error);
    return null;
  }
}

app.get('/', (req, res) => {
  res.send('Navi3 Sunucusu Çalışıyor!');
});

app.get('/test-route', (req, res) => {
  res.status(200).send('Test rotası çalışıyor!');
});

// Kullanıcı Giriş API Ucu (Basit Kimlik Doğrulama)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Basit, hardcoded kullanıcı adı ve şifre
  if (username === 'admin' && password === 'admin123') {
    res.status(200).json({ message: 'Giriş başarılı!', token: 'fake-jwt-token' });
  } else {
    res.status(401).json({ message: 'Kullanıcı adı veya şifre hatalı.' });
  }
});

// Şoförleri listele
app.get('/api/drivers', async (req, res) => {
  try {
    const snapshot = await db.collection('drivers').get();
    const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(drivers);
  } catch (error) {
    console.error("Şoförler alınırken hata oluştu:", error);
    res.status(500).send("Şoförler alınırken bir hata oluştu.");
  }
});

// ID'ye göre tek şoför getir
app.get('/api/drivers/:id', async (req, res) => {
  try {
    const driverId = req.params.id;
    const driverDoc = await db.collection('drivers').doc(driverId).get();

    if (!driverDoc.exists) {
      return res.status(404).send("Şoför bulunamadı.");
    }

    res.status(200).json({ id: driverDoc.id, ...driverDoc.data() });
  } catch (error) {
    console.error("Tek şoför alınırken hata oluştu:", error);
    res.status(500).send("Tek şoför alınırken bir hata oluştu.");
  }
});

// Yeni şoför ekle
app.post('/api/drivers', async (req, res) => {
  const { name, licensePlate, maxPallets, fixedStartAddress, fixedEndAddress } = req.body;

  if (!name || !licensePlate || !maxPallets || !fixedStartAddress || !fixedEndAddress) {
    return res.status(400).send("Tüm alanlar zorunludur.");
  }

  try {
    const fixedStartCoordinates = await geocodeAddress(fixedStartAddress);
    const fixedEndCoordinates = await geocodeAddress(fixedEndAddress);

    if (!fixedStartCoordinates || !fixedEndCoordinates) {
      return res.status(400).send("Başlangıç veya bitiş adresi için koordinatlar bulunamadı.");
    }

    const newDriver = {
      name,
      licensePlate,
      maxPallets: parseInt(maxPallets, 10),
      fixedStart: { address: fixedStartAddress, coordinates: fixedStartCoordinates },
      fixedEnd: { address: fixedEndAddress, coordinates: fixedEndCoordinates }
    };

    const docRef = await db.collection('drivers').add(newDriver);
    res.status(201).json({ id: docRef.id, ...newDriver });
  } catch (error) {
    console.error("Şoför eklenirken hata oluştu:", error);
    res.status(500).send("Şoför eklenirken bir hata oluştu.");
  }
});

// Şoför güncelle (ID ile)
app.put('/api/drivers/:id', async (req, res) => {
  const driverId = req.params.id;
  const { name, licensePlate, maxPallets, fixedStartAddress, fixedEndAddress } = req.body;

  if (!name || !licensePlate || !maxPallets || !fixedStartAddress || !fixedEndAddress) {
    return res.status(400).send("Tüm alanlar zorunludur.");
  }

  try {
    const fixedStartCoordinates = await geocodeAddress(fixedStartAddress);
    const fixedEndCoordinates = await geocodeAddress(fixedEndAddress);

    if (!fixedStartCoordinates || !fixedEndCoordinates) {
      return res.status(400).send("Başlangıç veya bitiş adresi için koordinatlar bulunamadı.");
    }

    const updatedDriver = {
      name,
      licensePlate,
      maxPallets: parseInt(maxPallets, 10),
      fixedStart: { address: fixedStartAddress, coordinates: fixedStartCoordinates },
      fixedEnd: { address: fixedEndAddress, coordinates: fixedEndCoordinates }
    };

    await db.collection('drivers').doc(driverId).set(updatedDriver, { merge: true });
    res.status(200).json({ id: driverId, ...updatedDriver });
  } catch (error) {
    console.error("Şoför güncellenirken hata oluştu:", error);
    res.status(500).send("Şoför güncellenirken bir hata oluştu.");
  }
});

// Şoför sil (ID ile)
app.delete('/api/drivers/:id', async (req, res) => {
  const driverId = req.params.id;
  try {
    await db.collection('drivers').doc(driverId).delete();
    res.status(200).send("Şoför başarıyla silindi.");
  } catch (error) {
    console.error("Şoför silinirken hata oluştu:", error);
    res.status(500).send("Şoför silinirken bir hata oluştu.");
  }
});

// Market verilerini Firestore'dan almak için API ucu
app.get('/api/markets', async (req, res) => {
  try {
    const snapshot = await db.collection('markets').get();
    const markets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(markets);
  } catch (error) {
    console.error("Marketler alınırken hata oluştu:", error);
    res.status(500).send("Marketler alınırken bir hata oluştu.");
  }
});

// Market verilerini Firestore'a eklemek için geçici route
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // Gecikme fonksiyonu

app.get('/seed-markets', async (req, res) => {
  const marketsToSeed = [
    { name: "V & R GmbH", city: "Essen", address: "Krayer Str. 109, 45307 Essen" },
    { name: "Dünya Market", city: "Essen", address: "Krayer Straße 231, 45307 Essen" },
    { name: "Kartal Market", city: "Essen", address: "Steeler Str. 143, 45138 Essen" },
    { name: "Türpa GmbH", city: "Essen", address: "Bäuminghausstraße 71, 45326 Essen" },
    { name: "Agora Fruit & Food GmbH", city: "Essen", address: "Altendorfer Str. 326, 45143 Essen" },
    { name: "Yesil GmbH", city: "Essen", address: "Lützowstraße 28c, 45141 Essen" },
    { name: "Sude Market", city: "Essen", address: "Lise-Meitner-Straße 1, 45144 Essen" },
    // --- Yeni Test Adresleri ---
    { name: "Test Market München", city: "München", address: "Marienplatz 1, 80331 München" },
    { name: "Test Market Stuttgart", city: "Stuttgart", address: "Schlossplatz 1, 70173 Stuttgart" },
    { name: "Test Market Nürnberg", city: "Nürnberg", address: "Hauptmarkt 1, 90403 Nürnberg" },
    { name: "Test Market Leipzig", city: "Leipzig", address: "Augustusplatz 1, 04109 Leipzig" },
    { name: "Test Market Berlin", city: "Berlin", address: "Alexanderplatz 1, 10178 Berlin" },
  ];

  try {
    const batch = db.batch();
    const marketsCollection = db.collection('markets');

    for (const market of marketsToSeed) {
      // Marketin zaten var olup olmadığını kontrol et
      const existingMarketSnapshot = await marketsCollection
        .where('name', '==', market.name)
        .where('address', '==', market.address)
        .get();

      if (!existingMarketSnapshot.empty) {
        console.log(`Market ${market.name} (${market.address}) zaten mevcut, atlanıyor.`);
        continue; // Zaten varsa atla
      }

      console.log(`İşleniyor: ${market.name}...`);
      const coordinates = await geocodeAddress(market.address);
      if (coordinates) {
        const docRef = marketsCollection.doc();
        batch.set(docRef, { ...market, coordinates });
        console.log(`--> YENİ MARKET EKLENDİ: ${market.name} (${market.address})`);
      } else {
        console.warn(`Market ${market.name} için koordinatlar bulunamadı, atlanıyor.`);
      }

      // HERE API rate limit'ini aşmamak için her istek arasında 1 saniye bekle
      await sleep(1000);
    }

    await batch.commit();
    res.status(200).send("Market verileri başarıyla Firestore'a eklendi!");
  } catch (error) {
    console.error("Marketler eklenirken hata oluştu:", error);
    res.status(500).send("Marketler eklenirken bir hata oluştu.");
  }
});

// KAMYON ROTA OPTİMİZASYONU - HERE Routing API v8 ile kendi matrix oluşturma
app.post('/api/optimize-route', async (req, res) => {
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

// Haversine distance hesaplama fonksiyonu
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Kamyon için TSP çözücü fonksiyon (başlangıç ve bitiş sabit)
function solveTSPForTruck(waypoints, distanceMatrix) {
  const n = waypoints.length;
  console.log(`TSP başlatılıyor: ${n} waypoint`);
  
  if (n <= 2) {
    return waypoints.map((wp, index) => ({
      ...wp,
      id: index === 0 ? 'start' : 'end',
      sequenceNumber: index
    }));
  }
  
  // İlk nokta (start) ve son nokta (end) sabit kalmalı
  const startPoint = { ...waypoints[0], id: 'start', sequenceNumber: 0 };
  const endPoint = { ...waypoints[waypoints.length - 1], id: 'end' };
  const middlePoints = waypoints.slice(1, -1); // Ara noktalar
  
  console.log(`Ara nokta sayısı: ${middlePoints.length}`);
  
  if (middlePoints.length === 0) {
    return [startPoint, { ...endPoint, sequenceNumber: 1 }];
  }
  
  // Ara noktalar için en yakın komşu algoritması
  const visited = new Array(middlePoints.length).fill(false);
  const result = [startPoint];
  
  let currentIndex = 0; // Start noktasının matrix'teki indeksi
  
  // Ara noktaları optimize et
  for (let i = 0; i < middlePoints.length; i++) {
    let nearestIndex = -1;
    let minDistance = Infinity;
    
    // Henüz ziyaret edilmemiş ara noktalar arasında en yakınını bul
    for (let j = 0; j < middlePoints.length; j++) {
      if (!visited[j]) {
        const middlePointMatrixIndex = j + 1; // Matrix'te ara noktaların indeksi (start'tan sonra başlar)
        
        // Distance matrix kontrolü
        if (distanceMatrix[currentIndex] && 
            distanceMatrix[currentIndex].travelTimes && 
            typeof distanceMatrix[currentIndex].travelTimes[middlePointMatrixIndex] === 'number') {
          
          const distance = distanceMatrix[currentIndex].travelTimes[middlePointMatrixIndex];
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = j;
          }
        }
      }
    }
    
    if (nearestIndex !== -1) {
      visited[nearestIndex] = true;
      result.push({
        ...middlePoints[nearestIndex],
        // id zaten middlePoints içinde geliyor, tekrar atamaya gerek yok
        sequenceNumber: result.length
      });
      currentIndex = nearestIndex + 1; // Matrix'te bu noktanın indeksi
      console.log(`${i + 1}. nokta eklendi: via_${nearestIndex}`);
    } else {
      console.warn(`${i + 1}. adımda en yakın nokta bulunamadı`);
      // Fallback: İlk ziyaret edilmemiş noktayı al
      for (let j = 0; j < middlePoints.length; j++) {
        if (!visited[j]) {
          visited[j] = true;
          result.push({
            ...middlePoints[j],
            id: `via_${j}`,
            sequenceNumber: result.length
          });
          currentIndex = j + 1;
          break;
        }
      }
    }
  }
  
  // Son noktayı ekle
  result.push({
    ...endPoint,
    sequenceNumber: result.length
  });
  
  console.log(`TSP tamamlandı: ${result.length} nokta`);
  return result;
}

// Optimize edilmiş rota için detaylı yol tarifi al
app.post('/api/detailed-route', async (req, res) => {
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde başlatıldı.`);
});