const fetch = require('node-fetch').default; // Node.js ortamında fetch kullanmak için

async function geocodeAddress(address) {
  const HERE_API_KEY = process.env.HERE_API_KEY; // Ortam değişkeninden al
  const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${HERE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const { position, address } = data.items[0];
      return {
        lat: position.lat,
        lng: position.lng,
        fullAddress: address.label,
        street: address.street,
        houseNumber: address.houseNumber,
        postalCode: address.postalCode,
        city: address.city,
        country: address.countryName
      };
    } else {
      console.warn(`Adres için koordinat bulunamadı: ${address}`);
      return null;
    }
  } catch (error) {
    console.error(`Geocoding hatası ${address}:`, error);
    return null;
  }
}

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

module.exports = { geocodeAddress, calculateHaversineDistance };