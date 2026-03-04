import "dotenv/config";
import { db } from "../server/db";
import { adminUsers } from "../shared/schema";
import { hashPassword } from "../server/services/auth";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  const email = "davy.devop@gmail.com";
  const displayName = "Davy";
  const role = "admin";
  const defaultPassword = "kairos@2024"; // Change on first login

  // Check if already exists
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  if (existing) {
    console.log(`Admin user ${email} already exists. Skipping.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(defaultPassword);
  const [admin] = await db.insert(adminUsers).values({
    email,
    passwordHash,
    displayName,
    role,
    active: true,
  }).returning();

  console.log(`Admin user created:`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Name: ${admin.displayName}`);
  console.log(`  Role: ${admin.role}`);
  console.log(`  Password: ${defaultPassword}`);
  console.log(`  ID: ${admin.id}`);

  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
