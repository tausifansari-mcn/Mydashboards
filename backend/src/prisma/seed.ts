import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const processes = [
  { name: 'Bellavita', lob: 'Inbound', dialdeskId: 375 },
  { name: 'Bellavita', lob: 'Outbound', dialdeskId: 375 },
  { name: 'Clovia', lob: 'Inbound', dialdeskId: 468 },
  { name: 'GNC', lob: 'Inbound', dialdeskId: 409 },
  { name: 'GNC', lob: 'Outbound', dialdeskId: 409 },
  { name: "Neeman's", lob: 'Inbound', dialdeskId: 475 },
  { name: "Neeman's", lob: 'Outbound', dialdeskId: 475 },
  { name: 'Viega', lob: 'Inbound', dialdeskId: 352 },
  { name: 'Exicom', lob: 'Inbound', dialdeskId: 326 },
  { name: 'BirlaNu', lob: 'Outbound', dialdeskId: 477 },
  { name: 'Du Digital BD', lob: 'Inbound', dialdeskId: 380 },
  { name: 'Du Digital Korea', lob: 'Inbound', dialdeskId: 473 },
  { name: 'Du Digital Thailand', lob: 'Inbound', dialdeskId: 474 },
  { name: 'Reginald Men', lob: 'Outbound', dialdeskId: 481 },
  { name: 'VST', lob: 'Outbound', dialdeskId: 489 },
  { name: 'Wryze', lob: 'Outbound', dialdeskId: 471 },
  { name: 'AW', lob: 'IB/OB', dialdeskId: 490 },
  { name: 'Housing', lob: 'Outbound', dialdeskId: 413 },
  { name: 'Solveesy', lob: 'Outbound', dialdeskId: 491 },
  { name: 'B3', lob: 'Inbound', dialdeskId: 486 },
  { name: 'B3', lob: 'Outbound', dialdeskId: 486 },
  { name: 'Finfort', lob: 'Outbound', dialdeskId: 492 },
];

const clientNames = [
  { name: 'Bellavita', dialdeskId: 375 },
  { name: 'Clovia', dialdeskId: 468 },
  { name: 'GNC', dialdeskId: 409 },
  { name: "Neeman's", dialdeskId: 475 },
  { name: 'Viega', dialdeskId: 352 },
  { name: 'Exicom', dialdeskId: 326 },
  { name: 'BirlaNu', dialdeskId: 477 },
  { name: 'Du Digital BD', dialdeskId: 380 },
  { name: 'Du Digital Korea', dialdeskId: 473 },
  { name: 'Du Digital Thailand', dialdeskId: 474 },
  { name: 'Reginald Men', dialdeskId: 481 },
  { name: 'VST', dialdeskId: 489 },
  { name: 'Wryze', dialdeskId: 471 },
  { name: 'AW', dialdeskId: 490 },
  { name: 'Housing', dialdeskId: 413 },
  { name: 'Solveesy', dialdeskId: 491 },
  { name: 'B3', dialdeskId: 486 },
  { name: 'Finfort', dialdeskId: 492 },
];

const dashboards = [
  { name: 'Call Master', slug: 'call-master', icon: 'Phone', description: 'Executive call analytics dashboard', sort_order: 1, is_active: true },
  { name: 'Quality Dashboard', slug: 'quality', icon: 'Star', description: 'QA analytics and quality scores', sort_order: 2, is_active: false },
  { name: 'Sales Dashboard', slug: 'sales', icon: 'TrendingUp', description: 'Sales funnel and conversion analytics', sort_order: 3, is_active: false },
  { name: 'Client Dashboard', slug: 'client', icon: 'Users', description: 'Client health and performance', sort_order: 4, is_active: false },
  { name: 'Operations Dashboard', slug: 'operations', icon: 'BarChart2', description: 'Operational metrics overview', sort_order: 5, is_active: false },
  { name: 'Agent Dashboard', slug: 'agent', icon: 'UserCheck', description: 'Agent scorecards and analytics', sort_order: 6, is_active: false },
];

async function main() {
  console.log('Seeding database...');

  // Roles
  const roles = [
    { name: 'super_admin', display_name: 'Super Admin' },
    { name: 'client_admin', display_name: 'Client Admin' },
    { name: 'manager', display_name: 'Manager' },
    { name: 'qa', display_name: 'QA' },
  ];

  for (const role of roles) {
    await prisma.md_roles.upsert({
      where: { id: roles.indexOf(role) + 1 },
      update: {},
      create: role,
    });
  }
  console.log('Roles seeded');

  const superAdminRole = await prisma.md_roles.findFirst({ where: { name: 'super_admin' } });
  if (!superAdminRole) throw new Error('super_admin role not found');

  // Clients
  for (const c of clientNames) {
    await prisma.md_clients.upsert({
      where: { dialdesk_client_id: c.dialdeskId },
      update: { name: c.name },
      create: { name: c.name, dialdesk_client_id: c.dialdeskId },
    });
  }
  console.log('Clients seeded');

  // Processes
  for (const p of processes) {
    const client = await prisma.md_clients.findUnique({ where: { dialdesk_client_id: p.dialdeskId } });
    if (!client) continue;
    const existing = await prisma.md_processes.findFirst({
      where: { client_id: client.id, process_name: p.name, lob: p.lob },
    });
    if (!existing) {
      await prisma.md_processes.create({
        data: {
          client_id: client.id,
          process_name: p.name,
          lob: p.lob,
          dialdesk_client_id: p.dialdeskId,
        },
      });
    }
  }
  console.log('Processes seeded');

  // Dashboards
  for (const d of dashboards) {
    await prisma.md_dashboards.upsert({
      where: { slug: d.slug },
      update: {},
      create: d,
    });
  }
  console.log('Dashboards seeded');

  // Super Admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@masscallnet.in';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const adminName = process.env.SEED_ADMIN_NAME || 'Super Admin';
  const hash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.md_users.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      password_hash: hash,
      role_id: superAdminRole.id,
      client_id: null,
    },
  });

  // Grant all dashboards to super admin
  const allDashboards = await prisma.md_dashboards.findMany();
  for (const dash of allDashboards) {
    await prisma.md_dashboard_access.upsert({
      where: { user_id_dashboard_id: { user_id: adminUser.id, dashboard_id: dash.id } },
      update: {},
      create: { user_id: adminUser.id, dashboard_id: dash.id, can_export: true, granted_by: adminUser.id },
    });
  }

  console.log(`Super admin created: ${adminEmail}`);
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
