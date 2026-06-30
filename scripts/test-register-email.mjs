// Script de test : inscription + vérification email dans Mailpit
// Usage: node scripts/test-register-email.mjs

const BASE_URL = "http://localhost:3002";

async function main() {
  console.log("=== Test inscription + email d'activation ===\n");

  // 1. Récupérer le token CSRF + cookie
  console.log("1. Récupération du token CSRF...");
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const rawCookie = csrfRes.headers.get("set-cookie") || "";
  const cookieValue = rawCookie.split(";")[0]; // "next-auth.csrf-token=..."

  if (!csrfToken) {
    console.error("❌ Impossible d'obtenir le token CSRF");
    console.error("Response:", csrfData);
    process.exit(1);
  }
  console.log("✅ CSRF token obtenu:", csrfToken.substring(0, 20) + "...");

  // 2. Inscription
  const email = `test.mailpit.${Date.now()}@example.com`;
  const phone = `+2376900${Math.floor(10000 + Math.random() * 89999)}`;
  console.log(`\n2. Inscription avec email: ${email}`);

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieValue,
    },
    body: JSON.stringify({
      firstName: "Alice",
      lastName: "TestMailpit",
      phone,
      email,
      password: "password123",
      confirmPassword: "password123",
    }),
  });

  const registerBody = await registerRes.json();
  console.log("Status:", registerRes.status);
  console.log("Body:", JSON.stringify(registerBody));

  if (registerRes.status !== 201) {
    console.error("❌ Échec de l'inscription");
    process.exit(1);
  }

  console.log("\n✅ Inscription réussie!");
  console.log("→ Vérifiez Mailpit sur http://localhost:8025");
  console.log(`→ Email envoyé à: ${email}`);
  console.log(`→ userId: ${registerBody.userId}`);

  // 3. Attendre un peu puis vérifier Mailpit API
  console.log("\n3. Vérification dans Mailpit (attente 2s)...");
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const mailpitRes = await fetch("http://localhost:8025/api/v1/messages?limit=5");
    if (mailpitRes.ok) {
      const mailpitData = await mailpitRes.json();
      const messages = mailpitData.messages || [];
      const activationEmail = messages.find(
        (m) => m.Subject && m.Subject.includes("Activez votre compte")
      );
      if (activationEmail) {
        console.log("✅ Email d'activation trouvé dans Mailpit!");
        console.log("   Sujet:", activationEmail.Subject);
        console.log("   À:", activationEmail.To?.[0]?.Address);
        console.log("   ID:", activationEmail.ID);
      } else {
        console.log("⚠️  Aucun email d'activation trouvé dans Mailpit.");
        console.log("   Emails reçus:", messages.map((m) => m.Subject).join(", ") || "aucun");
      }
    }
  } catch (e) {
    console.log("⚠️  Impossible de contacter Mailpit API:", e.message);
  }
}

main().catch(console.error);
