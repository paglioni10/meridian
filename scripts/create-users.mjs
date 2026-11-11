import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const emails = (process.env.ALLOWED_EMAILS ?? "")
  .split(/[,;\s]+/)
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (!url || !key || emails.length === 0) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e ALLOWED_EMAILS.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

for (const email of emails) {
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (!error) console.log(`criado: ${email}`);
  else if (error.code === "email_exists") console.log(`já existe: ${email}`);
  else {
    console.error(`erro em ${email}: ${error.message}`);
    process.exitCode = 1;
  }
}
