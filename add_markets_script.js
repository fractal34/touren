require('dotenv').config();
const { db } = require('./src/config/firebase');
const { geocodeAddress } = require('./src/utils/geoHelpers');
const readline = require('readline');

// Kullanıcının sabit ownerId'si
const ownerIdArg = process.argv[2];

if (!ownerIdArg) {
    console.error('Hata: Lütfen ownerId'yi komut satırı argümanı olarak belirtin. Örn: node add_markets_script.js <ownerId>');
    process.exit(1);
}

const OWNER_ID = ownerIdArg;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const marketsToAdd = [];

function askForMarketName() {
    rl.question('Market Adı (çıkmak için \'bitti\'): ', (marketName) => {
        if (marketName.toLowerCase() === 'bitti') {
            if (marketsToAdd.length > 0) {
                addMarkets();
            } else {
                console.log('Hiç market eklenmedi. Çıkılıyor.');
                rl.close();
            }
            return;
        }
        askForLocation(marketName);
    });
}

function askForLocation(marketName) {
    rl.question(`Şehir (${marketName}): `, (location) => {
        if (location) {
            marketsToAdd.push({ marketName, location });
            console.log(` -> Listeye eklendi: ${marketName}, ${location}\n`);
        }
        askForMarketName(); // Bir sonraki marketi sor
    });
}

async function addMarkets() {
    console.log(`\n${marketsToAdd.length} adet market veritabanına ekleniyor...`);
    rl.close();

    for (const market of marketsToAdd) {
        const searchQuery = `${market.marketName}, ${market.location}`;
        console.log(`-> İşleniyor: ${searchQuery}`);

        try {
            const geocodeResult = await geocodeAddress(searchQuery);

            if (!geocodeResult || !geocodeResult.lat || !geocodeResult.lng) {
                console.error(`  [HATA] Adres bulunamadı: "${searchQuery}"`);
                continue;
            }

            const newMarket = {
                ownerId: OWNER_ID,
                name: market.marketName,
                customerNumber: '',
                address: geocodeResult.fullAddress,
                addressDetails: {
                    street: geocodeResult.street || '',
                    number: geocodeResult.houseNumber || '',
                    zip: geocodeResult.postalCode || '',
                    city: geocodeResult.city || '',
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
            console.log(`  [BAŞARILI] Eklendi: ${geocodeResult.fullAddress} (ID: ${docRef.id})`);

        } catch (error) {
            console.error(`  [HATA] Sunucu hatası oluştu: "${searchQuery}"`, error);
        }
    }

    console.log('\nToplu market ekleme işlemi tamamlandı.');
    // Firestore bağlantısının kapanması için biraz bekle
    setTimeout(() => process.exit(0), 2000);
}

console.log('Toplu Market Ekleme Scripti');
console.log('----------------------------');
console.log('Lütfen market adını ve ardından şehir bilgisini girin.');
console.log('Girişi bitirmek için market adı olarak \'bitti\' yazın.\n');

askForMarketName();