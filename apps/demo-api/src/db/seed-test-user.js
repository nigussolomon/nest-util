#!/usr/bin/env node
/**
 * Seed a test user with all permissions for payment testing.
 *
 * Usage:
 *   node apps/demo-api/src/db/seed-test-user.js
 *
 * Credentials:
 *   email:    test@example.com
 *   password: password123
 */
const { Client } = require('pg');
const { hashSync } = require('/home/fenkin/Work/DEVTOOLS/nest-util/node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs');

const ALL_PERMISSIONS = [
  'admin.access',
  'users.read', 'users.manage',
  'posts.read', 'posts.create', 'posts.update', 'posts.delete', 'posts.audit',
  'payments.create', 'payments.read', 'payments.refund', 'payments.subscribe', 'payments.reconcile',
  'files.create', 'files.read', 'files.delete',
];

async function seed() {
  const c = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'demo_user',
    password: process.env.DB_PASSWORD || 'demo_pass',
    database: process.env.DB_NAME || 'demo_db',
  });

  await c.connect();

  try {
    await c.query('BEGIN');

    // Upsert user
    const email = 'test@example.com';
    const passwordHash = hashSync('password123', 10);

    let res = await c.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (res.rows.length === 0) {
      res = await c.query(
        'INSERT INTO users (email, name, password, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING id',
        [email, 'Test User', passwordHash]
      );
      userId = res.rows[0].id;
      console.log(`Created user: ${email} (id=${userId})`);
    } else {
      userId = res.rows[0].id;
      console.log(`User exists: ${email} (id=${userId})`);
    }

    // Upsert role
    res = await c.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    let roleId;
    if (res.rows.length === 0) {
      res = await c.query(
        'INSERT INTO roles (name, description, permissions, "isSystem", "createdAt", "updatedAt") VALUES ($1, $2, $3, false, NOW(), NOW()) RETURNING id',
        ['admin', 'Full access admin role', ALL_PERMISSIONS.join(',')]
      );
      roleId = res.rows[0].id;
      console.log(`Created role: admin (id=${roleId})`);
    } else {
      roleId = res.rows[0].id;
      await c.query('UPDATE roles SET permissions = $1 WHERE id = $2', [ALL_PERMISSIONS.join(','), roleId]);
      console.log(`Updated role: admin (id=${roleId})`);
    }

    // Assign role to user
    res = await c.query('SELECT id FROM user_roles WHERE "userId" = $1 AND "roleId" = $2', [userId, roleId]);
    if (res.rows.length === 0) {
      await c.query(
        'INSERT INTO user_roles ("userId", "roleId", "createdAt") VALUES ($1, $2, NOW())',
        [userId, roleId]
      );
      console.log(`Assigned admin role to ${email}`);
    } else {
      console.log(`User already has admin role`);
    }

    await c.query('COMMIT');
    console.log('\nDone! Login with:');
    console.log(`  email:    ${email}`);
    console.log(`  password: password123`);
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

seed();
