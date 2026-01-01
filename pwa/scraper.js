// Facebook Scraper pentru PWA
// Folosește aceeași logică ca checkForNewPost.js

const TARGET_GROUPS = [
  {
    name: 'Curierul Perfect',
    url: 'https://www.facebook.com/groups/1784041808422081/'
  }
];

// Helper: Verifică dacă timestamp e în ultimele 7 zile
function isTimeWithinRange(timeText) {
  const t = timeText.toLowerCase();
  
  // Hours/minutes - ACCEPTĂ
  if (t.match(/^\d+\s*(s|sec|m|min|minute|minutes|h|hr|hour|hours|oră|ore)$/i)) {
    return { valid: true, reason: "Recent" };
  }
  
  // Days up to 6 - ACCEPTĂ
  if (t.match(/^\d+\s*d(ay)?s?$/i)) {
    const days = parseInt(t.match(/\d+/)[0]);
    if (days <= 6) {
      return { valid: true, reason: `${days} days ago` };
    }
  }
  
  // Yesterday - ACCEPTĂ
  if (t.match(/yesterday|ieri/i)) {
    return { valid: true, reason: "Yesterday" };
  }
  
  // Weekdays - ACCEPTĂ
  if (t.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday|luni|marți|miercuri|joi|vineri|sâmbătă|duminică/i)) {
    return { valid: true, reason: "This week" };
  }
  
  // Unknown - ACCEPTĂ (poate fi foarte recent)
  if (t === 'unknown' || t === '') {
    return { valid: true, reason: "Unknown (accepted)" };
  }
  
  return { valid: false, reason: "Too old" };
}

// Helper: Verifică dacă postarea conține keywords relevante
function containsTransportKeywords(text) {
  const lowerText = text.toLowerCase();
  
  // FILTRU ANTI-RECLAMĂ: Exclude advertisers
  const advertiserKeywords = [
    'oferim transport', 'oferim servicii', 'oferim', 'va oferim',
    'firma de transport', 'firma transport', 'companie transport', 'firma noastra',
    'suntem firma', 'suntem companie',
    'asiguram transport', 'efectuam transport',
    'transport profesional', 'servicii profesionale',
    'disponibil transport', 'disponibili pentru',
    'furnizam transport', 'prestam servicii',
    'licentiat', 'autorizat', 'autorizata', 'licenta',
    'ani experienta', 'experienta de',
    'flota proprie', 'vehicule proprii',
    'tarife avantajoase', 'preturi competitive',
    'suntem specializati', 'specializat in',
    'garantam', 'va garantam', 'garantie',
    'profesionisti', 'profesionist',
    'contact', 'contactati-ne', 'sunati', 'apelati', 'whatsapp', 'telefon',
    'website', 'site', 'pagina noastra', 'facebook.com',
    'putem', 'va putem', 'stim', 'va ajutam',
    'compania noastra', 'firma mea', 'societate',
    'certificat', 'certificate', 'acreditat'
  ];
  
  for (const keyword of advertiserKeywords) {
    if (lowerText.includes(keyword)) {
      return { relevant: false, reason: 'advertiser' };
    }
  }
  
  // CERERE DE LA CLIENT: Cuvântul "caut"
  if (!lowerText.includes('caut')) {
    return { relevant: false, reason: 'no_request_keyword' };
  }
  
  // SERVICII: 9 categorii
  const serviceKeywords = {
    '🚚 Transport Marfa': ['transport marfa', 'transport colet', 'marfa', 'colete', 'pachete', 'bagaje'],
    '📦 Mutari/Relocari': ['mutare', 'relocare', 'mutam', 'mut', 'mut apartament', 'mut casa'],
    '🛋️ Transport Mobila': ['transport mobila', 'transport mobilier', 'mobila', 'mobilier', 'canapea', 'dulap', 'pat'],
    '📬 Curierat/Livrari': ['curier', 'livrare', 'livrari', 'livrat', 'livrez', 'courier', 'delivery'],
    '🌍 Transport International': ['transport international', 'transport extern', 'export', 'import', 'transport europa'],
    '🚗 Transport Auto': ['transport auto', 'transport masina', 'transport vehicul', 'platforma auto', 'tractare'],
    '🐾 Transport Animale': ['transport animale', 'transport caini', 'transport pisici', 'transport cal', 'pet transport'],
    '📦 Depozitare': ['depozitare', 'stocare', 'depozit', 'spatiu depozitare', 'pastrare'],
    '📦 Ambalare': ['ambalare', 'impachetare', 'ambalat', 'ambalaj', 'materiale ambalare']
  };
  
  for (const [service, keywords] of Object.entries(serviceKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return { relevant: true, service, keyword };
      }
    }
  }
  
  return { relevant: false, reason: 'no_service_keywords' };
}

// IMPORTANT: Această funcție trebuie rulată în context de browser (Chrome Extension)
// Pentru PWA, vom primi datele de la extension prin API
module.exports = {
  TARGET_GROUPS,
  isTimeWithinRange,
  containsTransportKeywords
};
