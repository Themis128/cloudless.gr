import http from "node:http";

const TEST_BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || "4000"}`;

const pages = [
  { path: "/", expect: "EN" },
  { path: "/el", expect: "EL" },
  { path: "/fr", expect: "FR" },
  { path: "/services", expect: "EN" },
  { path: "/el/services", expect: "EL" },
  { path: "/fr/services", expect: "FR" },
  { path: "/contact", expect: "EN" },
  { path: "/el/contact", expect: "EL" },
  { path: "/fr/contact", expect: "FR" },
  { path: "/store", expect: "EN" },
  { path: "/el/store", expect: "EL" },
  { path: "/fr/store", expect: "FR" },
  { path: "/auth/login", expect: "EN" },
  { path: "/el/auth/login", expect: "EL" },
  { path: "/fr/auth/login", expect: "FR" },
];

const markers = {
  EN: {
    home: ["Clear skies", "Get a Free Audit", "View Services"],
    services: ["Cloud Architecture", "Serverless Development", "Data Analytics"],
    contact: ["Get in Touch", "Send Message"],
    store: ["Our Products", "Add to Cart"],
    auth: ["Sign In", "Forgot Password"],
  },
  EL: {
    home: ["Καθαροί ουρανοί", "Δωρεάν Έλεγχος", "Δείτε τις Υπηρεσίες"],
    services: ["Αρχιτεκτονική Cloud", "Serverless Development", "Ανάλυση Δεδομένων"],
    contact: ["Επικοινωνήστε μαζί μας", "Αποστολή Μηνύματος"],
    store: ["Προϊόντα μας", "Προσθήκη στο Καλάθι"],
    auth: ["Σύνδεση", "Ξεχάσατε τον κωδικό"],
  },
  FR: {
    home: ["Ciel dégagé", "Audit Gratuit", "Voir les Services"],
    services: ["Architecture Cloud", "Développement Serverless", "Analyse de Données"],
    contact: ["Contactez-nous", "Envoyer le Message"],
    store: ["Nos Produits", "Ajouter au Panier"],
    auth: ["Connexion", "Mot de passe oublié"],
  },
};

function fetch(path) {
  return new Promise((resolve, reject) => {
    http.get(TEST_BASE_URL + path, { timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    }).on("error", reject);
  });
}

function getSection(path) {
  if (path.includes("/services")) return "services";
  if (path.includes("/contact")) return "contact";
  if (path.includes("/store")) return "store";
  if (path.includes("/auth")) return "auth";
  return "home";
}

let passed = 0;
let failed = 0;
const failures = [];

console.log(`Testing locale routes against ${TEST_BASE_URL}`);

for (const { path, expect: lang } of pages) {
  try {
    const { status, body } = await fetch(path);
    const section = getSection(path);
    const checks = markers[lang][section];
    const found = checks.filter((m) => body.includes(m));
    const missing = checks.filter((m) => !body.includes(m));

    if (status === 200 && missing.length === 0) {
      console.log(`✅ ${path} => ${status} | ${lang} | ${found.length}/${checks.length} markers found`);
      passed++;
    } else {
      console.log(`❌ ${path} => ${status} | Expected ${lang} | Found ${found.length}/${checks.length} markers`);
      if (missing.length > 0) console.log(`   Missing: ${missing.join(", ")}`);
      failed++;
      failures.push({ path, lang, missing, status });
    }
  } catch (e) {
    console.log(`❌ ${path} => ERROR: ${e.message}`);
    failed++;
    failures.push({ path, error: e.message });
  }
}

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed out of ${pages.length} ===`);
if (failures.length > 0) {
  console.log("\nFAILURES:");
  failures.forEach((f) => console.log(`  ${f.path}: ${f.missing?.join(", ") || f.error}`));
}
