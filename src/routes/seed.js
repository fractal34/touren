const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { geocodeAddress } = require('../utils/geoHelpers');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // Gecikme fonksiyonu

router.get('/seed-markets', async (req, res) => {
  // Helper function to parse address string into structured details
  function parseAddress(addressString, defaultCity = '', defaultCountry = 'Almanya') {
      const parts = addressString.split(',').map(p => p.trim());
      let street = '';
      let number = '';
      let zip = '';
      let city = defaultCity;
      let country = defaultCountry;

      // Attempt to parse based on common German address formats
      // Example: "Krayer Str. 109, 45307 Essen" or "Königstraße 55, 47051 Duisburg"
      if (parts.length >= 2) {
          const streetAndNumber = parts[0];
          const zipAndCity = parts[1];

          // Parse street and number
          const streetMatch = streetAndNumber.match(/(.*)\s+(\d+[a-zA-Z]?)$/);
          if (streetMatch) {
              street = streetMatch[1].trim();
              number = streetMatch[2].trim();
          } else {
              street = streetAndNumber;
          }

          // Parse zip and city
          const zipCityMatch = zipAndCity.match(/(\d{5})\s+(.*)/);
          if (zipCityMatch) {
              zip = zipCityMatch[1].trim();
              city = zipCityMatch[2].trim();
          } else {
              city = zipAndCity; // Fallback if zip not found
          }
      } else {
          // Fallback for simpler addresses like "Oststraße, Duisburg"
          street = parts[0] || '';
          city = parts[1] || defaultCity;
      }

      // Ensure city is set, even if not explicitly parsed
      if (!city && defaultCity) {
          city = defaultCity;
      }

      return {
          street: street || '',
          number: number || '',
          zip: zip || '',
          city: city || defaultCity,
          country: country
      };
  }

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
    // --- Yeni Duisburg Marketleri ---
    { name: "Duisburg Merkez Market", city: "Duisburg", address: "Königstraße 55, 47051 Duisburg" },
    { name: "Duisburg Güney Market", city: "Duisburg", address: "Düsseldorfer Str. 100, 47051 Duisburg" },
    { name: "Duisburg Kuzey Market", city: "Duisburg", address: "Friedrich-Ebert-Straße 120, 47137 Duisburg" },
    { name: "Duisburg Doğu Market", city: "Duisburg", address: "Am Parallelhafen 30, 47059 Duisburg" },
    { name: "Duisburg Batı Market", city: "Duisburg", address: "Mercatorstraße 1, 47051 Duisburg" },
    { name: "Sentürk Hamborn", city: "Duisburg", address: "Kalthoffstraße 95, 47166 Duisburg" },
    { name: "Istanbul Markt", city: "Duisburg", address: "Kaiser-Friedrich-Str. 20-24, 47169 Duisburg" },
    { name: "D 101 GmbH", city: "Duisburg", address: "Hamborner Altmarkt 11, 47166 Duisburg" },
    { name: "Sentürk Meiderich", city: "Duisburg", address: "Mühlenstraße 69, 47137 Duisburg" },
    { name: "Cetin Market", city: "Duisburg", address: "Friedrich-Ebert-Straße 322, 47139 Duisburg" },
    { name: "Fatih Market", city: "Duisburg", address: "Friedrich-Ebert-Str. 354, 47139 Duisburg" },
    { name: "Burc GmbH", city: "Duisburg", address: "Mülheimer Straße 128, 47057 Duisburg" },
    { name: "Yasmeen Frischmarkt", city: "Duisburg", address: "Oststraße, Duisburg" },
    { name: "Sara Market", city: "Duisburg", address: "Gitschiner Str. 47, 47053 Duisburg" },
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
      const addressDetails = parseAddress(market.address, market.city); // Parse address string

      if (coordinates) {
        const docRef = marketsCollection.doc();
        batch.set(docRef, { ...market, coordinates, addressDetails }); // Include addressDetails
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

module.exports = router;