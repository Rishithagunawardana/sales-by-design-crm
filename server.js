import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import session from 'express-session';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables manually if exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key) process.env[key] = val;
    }
  }
}

const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'database.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Xero SDK configuration and dynamic loading (Proposal system integration)
let XeroClient;
let xero;
let xeroAvailable = false;

try {
  const xeroNode = await import('xero-node');
  XeroClient = xeroNode.XeroClient;
  xeroAvailable = true;
  console.log('Xero SDK loaded successfully.');
} catch (err) {
  console.warn('Xero SDK (xero-node) could not be loaded. Xero integration is disabled, but SMTP email service remains active.', err.message);
}

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const scopes = [
  'openid',
  'profile',
  'email',
  'accounting.transactions',
  'accounting.contacts',
  'offline_access'
];

if (xeroAvailable && XeroClient) {
  try {
    xero = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID,
      clientSecret: process.env.XERO_CLIENT_SECRET,
      redirectUris: [process.env.XERO_REDIRECT_URI],
      scopes: scopes
    });
  } catch (err) {
    console.error('Failed to initialize Xero client:', err.message);
    xeroAvailable = false;
  }
}

// Initialize SMTP Transporter for Email Service (Proposal system integration)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Initialize SQLite database
// Initialize libSQL/Turso database client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${DB_FILE}`,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const db = {
  exec: async (sql) => {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
  },
  prepare: (sql) => {
    return {
      all: async (...args) => {
        const res = await client.execute({ sql, args });
        return res.rows;
      },
      get: async (...args) => {
        const res = await client.execute({ sql, args });
        return res.rows[0];
      },
      run: async (...args) => {
        const res = await client.execute({ sql, args });
        return {
          lastInsertRowid: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : null,
          changes: res.rowsAffected
        };
      }
    };
  }
};

// --- DB SCHEMA ---
async function initDatabase() {
  // Safe migration block to transition from simple chat schema to channels/DMs schema
  try {
    const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'").get();
    if (tableCheck) {
      const colCheck = await db.prepare("PRAGMA table_info(chat_messages)").all();
      const hasOldCol = colCheck.some(c => c.name === 'channel_type');
      if (hasOldCol) {
        console.log("Detected legacy chat schema. Migrating database tables...");
        await db.exec("DROP TABLE IF EXISTS chat_messages");
        await db.exec("DROP TABLE IF EXISTS channel_members");
        await db.exec("DROP TABLE IF EXISTS chat_channels");
      }
    }
  } catch (err) {
    console.log("Migration check skipped/failed:", err.message);
  }

  await db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE,
    password TEXT,
    hourly_rate REAL DEFAULT 0,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    agency TEXT,
    phone TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    primary_email TEXT NOT NULL,
    secondary_emails TEXT, -- comma-separated
    phone TEXT,
    address TEXT,
    lead_source TEXT NOT NULL,
    referring_agent_id INTEGER,
    notes TEXT,
    FOREIGN KEY(referring_agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    agent_id INTEGER,
    recipient_type TEXT NOT NULL, -- 'Real Estate Agent' | 'Client'
    creation_type TEXT NOT NULL, -- 'Send from Floorplan/Online Photos' | 'Schedule a Quote Day'
    status TEXT NOT NULL, -- 'Draft' | 'Scheduled' | 'Sent' | 'Viewed' | 'Signed' | 'Declined' | 'Expired'
    bill_to TEXT NOT NULL, -- 'Client' | 'Agent'
    cc_agent_on_send INTEGER DEFAULT 0,
    lost_reason TEXT,
    hire_duration TEXT, -- '6 Weeks' | '8 Weeks' | 'Custom'
    flat_price REAL,
    created_by INTEGER,
    signature_name TEXT,
    signature_data TEXT,
    signed_at TEXT,
    visit_date TEXT,
    visit_time TEXT,
    visit_type TEXT, -- 'Viewing with Client' | 'Keysafe Access'
    visit_assigned_to INTEGER,
    FOREIGN KEY(client_id) REFERENCES clients(id),
    FOREIGN KEY(agent_id) REFERENCES agents(id),
    FOREIGN KEY(created_by) REFERENCES staff(id),
    FOREIGN KEY(visit_assigned_to) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS quote_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER,
    room_type TEXT NOT NULL,
    label TEXT,
    notes TEXT,
    FOREIGN KEY(quote_id) REFERENCES quotes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quote_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    item_name TEXT NOT NULL,
    attribute TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    is_template INTEGER DEFAULT 1,
    FOREIGN KEY(room_id) REFERENCES quote_rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS room_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    default_items TEXT NOT NULL -- JSON String
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER,
    client_id INTEGER,
    agent_id INTEGER,
    status TEXT NOT NULL, -- 'Booked' | 'Confirmed' | 'Install Scheduled' | 'In Progress' | 'Styled/Live' | 'De-install Scheduled' | 'Completed' | 'Extended' | 'Ended' | 'Cancelled'
    installation_date TEXT,
    is_tbc INTEGER DEFAULT 1,
    bill_to TEXT NOT NULL,
    hire_start_date TEXT,
    hire_end_date TEXT,
    extension_type TEXT, -- NULL | 'week-to-week' | 'fixed'
    property_sold INTEGER DEFAULT 0,
    stylist_id INTEGER,
    vehicle_id INTEGER,
    styling_visit_date TEXT,
    notes TEXT,
    FOREIGN KEY(quote_id) REFERENCES quotes(id),
    FOREIGN KEY(client_id) REFERENCES clients(id),
    FOREIGN KEY(agent_id) REFERENCES agents(id),
    FOREIGN KEY(stylist_id) REFERENCES staff(id),
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS item_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    room_tags TEXT,
    style_tags TEXT,
    total_quantity INTEGER DEFAULT 0,
    replacement_value REAL DEFAULT 0,
    useful_life_uses INTEGER DEFAULT 10,
    photo_url TEXT,
    condition_notes TEXT
  );

  CREATE TABLE IF NOT EXISTS location_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type_id INTEGER,
    location_type TEXT NOT NULL, -- 'warehouse' | 'job'
    location_id INTEGER, -- 0 for warehouse, job_id for jobs
    quantity INTEGER DEFAULT 0,
    FOREIGN KEY(item_type_id) REFERENCES item_types(id)
  );

  CREATE TABLE IF NOT EXISTS job_sourcing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    room_name TEXT,
    item_name TEXT,
    attribute TEXT,
    required_quantity INTEGER DEFAULT 1,
    item_type_id INTEGER, -- NULL if not sourced yet
    sourced_quantity INTEGER DEFAULT 0,
    source_type TEXT, -- 'warehouse' | 'pickup'
    source_job_id INTEGER,
    status TEXT NOT NULL, -- 'Not Sourced' | 'Pending Arrival' | 'Sourced' | 'Needs Attention'
    needs_attention_reason TEXT,
    needs_attention_resolved INTEGER DEFAULT 0,
    needs_attention_resolved_by INTEGER,
    needs_attention_resolved_at TEXT,
    needs_attention_note TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY(item_type_id) REFERENCES item_types(id),
    FOREIGN KEY(source_job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rego TEXT,
    day_rate REAL DEFAULT 0,
    capacity_notes TEXT
  );

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date TEXT NOT NULL,
    vehicle_id INTEGER,
    status TEXT NOT NULL DEFAULT 'Planned', -- 'Planned' | 'Departed' | 'Completed'
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS run_staff (
    run_id INTEGER,
    staff_id INTEGER,
    PRIMARY KEY(run_id, staff_id),
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS run_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    job_id INTEGER,
    stop_order INTEGER,
    stop_type TEXT NOT NULL, -- 'Install' | 'De-install'
    status TEXT NOT NULL DEFAULT 'Not Started', -- 'Not Started' | 'Arrived' | 'Departed'
    arrived_at TEXT,
    departed_at TEXT,
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stop_id INTEGER, -- NULL for general warehouse departure
    run_id INTEGER,
    type TEXT NOT NULL, -- 'Warehouse Departure' | 'Install Arrival' | 'Install Departure' | 'De-install Arrival' | 'De-install Departure'
    item_text TEXT NOT NULL,
    is_checked INTEGER DEFAULT 0,
    checked_by INTEGER,
    checked_at TEXT,
    FOREIGN KEY(stop_id) REFERENCES run_stops(id) ON DELETE CASCADE,
    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY(checked_by) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    status TEXT NOT NULL, -- 'With Agent' | 'Picked Up' | 'With Crew' | 'Dropped Off' | 'Returned'
    current_holder TEXT,
    updated_at TEXT,
    photo_url TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    type TEXT NOT NULL, -- 'Before' | 'Delivery Complete' | 'After/Completed' | 'Damage' | 'Key Handover'
    url TEXT NOT NULL,
    uploaded_by INTEGER,
    uploaded_at TEXT,
    room_name TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS damage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    description TEXT NOT NULL,
    repair_cost REAL DEFAULT 0,
    recharged_to_client INTEGER DEFAULT 0,
    photo_url TEXT,
    created_at TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS communications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER,
    job_id INTEGER,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Email' | 'SMS'
    sent_at TEXT NOT NULL,
    magic_token TEXT UNIQUE,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY(quote_id) REFERENCES quotes(id),
    FOREIGN KEY(job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS chat_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'global' | 'job' | 'direct' | 'group'
    job_id INTEGER,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS channel_members (
    channel_id INTEGER,
    staff_id INTEGER,
    PRIMARY KEY (channel_id, staff_id),
    FOREIGN KEY(channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    sender_id INTEGER,
    sender_name TEXT NOT NULL,
    message_text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    start_time TEXT,
    color TEXT DEFAULT 'var(--primary)',
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(created_by) REFERENCES staff(id)
  );
`);

  await seedDatabase();

  const dateStr = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  // Check if chat channels are empty and seed them
  const channelCount = await db.prepare("SELECT COUNT(*) as count FROM chat_channels").get();
  if (channelCount.count === 0) {
    // Seed chat channels
    await db.prepare("INSERT INTO chat_channels (id, name, type) VALUES (1, 'general-staff', 'global')").run();
    await db.prepare("INSERT INTO chat_channels (id, name, type, job_id) VALUES (2, 'job-1-arthur-dent', 'job', 1)").run();

    // Seed chat messages
    const insertChat = await db.prepare("INSERT INTO chat_messages (channel_id, sender_id, sender_name, message_text, created_at) VALUES (?, ?, ?, ?, ?)");
    await insertChat.run(1, 1, "Sarah Administrator", "Welcome to the Sales by Design internal chat! Use this space to coordinate staging runs.", dateStr(-1));
    await insertChat.run(1, 3, "Emma Stylist", "Hey Sarah, I've loaded the furniture layout for tomorrow's job. Dave, can you confirm Hino Truck capacity?", dateStr(0));
    await insertChat.run(1, 4, "Dave Crewman", "Yes Emma, Hino is fully prepped and ready for load-out.", dateStr(0));
    await insertChat.run(2, 3, "Emma Stylist", "Arthur Dent's property styled photos are looking great! Let me know if WHS inspections are complete.", dateStr(-13));
  }

  // Check if calendar events are empty and seed them
  const eventCount = await db.prepare("SELECT COUNT(*) as count FROM calendar_events").get();
  if (eventCount.count === 0) {
    const insertEvent = await db.prepare("INSERT INTO calendar_events (title, description, event_date, start_time, color) VALUES (?, ?, ?, ?, ?)");
    await insertEvent.run("Team Sync & Coffee", "Weekly operational catchup in the warehouse office.", dateStr(2), "09:00 AM", "var(--primary)");
    await insertEvent.run("Warehouse Tidying", "Organizing newly returned rugs and accent chairs.", dateStr(4), "01:30 PM", "var(--info)");
  }
}

// --- SEED DATABASE ---
async function seedDatabase() {
  // Check if staff table already has entries
  const staffCount = await db.prepare("SELECT COUNT(*) as count FROM staff").get();
  if (staffCount.count > 0) return;

  console.log("Seeding Database...");

  // 1. Seed Staff
  const insertStaff = await db.prepare("INSERT INTO staff (name, role, phone, email, password, hourly_rate) VALUES (?, ?, ?, ?, ?, ?)");
  await insertStaff.run("Sarah Administrator", "Admin", "0491 570 156", "sarah.admin@designbase.com", "admin123", 55.0);
  await insertStaff.run("Clara Management", "Head Stylist/Management", "0491 570 157", "clara.manager@designbase.com", "manager123", 45.0);
  await insertStaff.run("Emma Stylist", "Stylist", "0491 570 158", "emma.stylist@designbase.com", "stylist123", 35.0);
  await insertStaff.run("Dave Crewman", "Removalist Crew", "0491 570 159", "dave.crew@designbase.com", "crew123", 30.0);
  await insertStaff.run("John Crewman", "Removalist Crew", "0491 570 160", "john.crew@designbase.com", "crew123", 30.0);

  // 2. Seed Agents
  const insertAgent = await db.prepare("INSERT INTO agents (name, agency, phone, email) VALUES (?, ?, ?, ?)");
  await insertAgent.run("Marcus Brookes", "Ray White Prestige", "0412 345 678", "marcus.brookes@raywhite.com");
  await insertAgent.run("Jessica Vance", "McGrath Real Estate", "0423 456 789", "jessica.vance@mcgrath.com.au");
  await insertAgent.run("Tom Hardy", "LJ Hooker", "0434 567 890", "t.hardy@ljhooker.com.au");

  // 3. Seed Clients
  const insertClient = await db.prepare("INSERT INTO clients (name, primary_email, secondary_emails, phone, address, lead_source, referring_agent_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  await insertClient.run("Arthur Dent", "arthur.dent@galaxy.com", "ford.prefect@galaxy.com", "0401 111 222", "42 Galaxy Way, Cottons", "Referred by Agent", 1, "Wants standard Scandi vibe");
  await insertClient.run("Tricia McMillan", "trillian@galaxy.org", null, "0402 333 444", "15 Islington St, Newtown", "Google Advertising", null, "Vibrant color preferences");
  await insertClient.run("Ford Prefect", "ford@hitchhiker.com", null, "0403 444 555", "3 Arthur St, Balmain", "Referred by Agent", 2, "Vacant apartment styling");

  // 4. Seed Room Templates (Appendix A)
  const roomTemplates = [
    {
      name: "Hallway / Entry",
      items: [
        { item_name: "Prints / Mirror", attribute: "Medium Gold Frame", quantity: 1, unit_price: 25.0 }
      ]
    },
    {
      name: "Bedroom – Master",
      items: [
        { item_name: "Queen Bed – Oak Frame", attribute: "Queen Size", quantity: 1, unit_price: 150.0 },
        { item_name: "Side Table – Walnut Round", attribute: "Matching Pair", quantity: 2, unit_price: 30.0 },
        { item_name: "Floor Lamp – Black Metal Arc", attribute: "Warm Globe", quantity: 2, unit_price: 20.0 },
        { item_name: "Bed Linen & Throw Bundle", attribute: "Neutral Linen", quantity: 1, unit_price: 50.0 },
        { item_name: "Print / Mirror – Abstract Gold", attribute: "Abstract Print", quantity: 1, unit_price: 25.0 }
      ]
    },
    {
      name: "Bedroom – Standard",
      items: [
        { item_name: "Double Bed – Fabric Frame", attribute: "Double Size", quantity: 1, unit_price: 120.0 },
        { item_name: "Side Table – Walnut Round", attribute: "Matching Pair", quantity: 2, unit_price: 30.0 },
        { item_name: "Occasional Chair – Boucle White", attribute: "White Boucle", quantity: 1, unit_price: 45.0 },
        { item_name: "Bed Linen & Throw Bundle", attribute: "Green Accent", quantity: 1, unit_price: 50.0 },
        { item_name: "Print / Mirror – Abstract Gold", attribute: "Small Art", quantity: 1, unit_price: 20.0 }
      ]
    },
    {
      name: "Bedroom – Single/Study",
      items: [
        { item_name: "Single Bed – Metal Frame", attribute: "Single Size", quantity: 1, unit_price: 90.0 },
        { item_name: "Study Desk – Scandi Oak", attribute: "Oak Finish", quantity: 1, unit_price: 45.0 },
        { item_name: "Study Chair – Ergonomic Mesh", attribute: "Mesh Black", quantity: 1, unit_price: 20.0 },
        { item_name: "Side Table – Walnut Round", attribute: "Single Table", quantity: 1, unit_price: 15.0 },
        { item_name: "Bed Linen & Throw Bundle", attribute: "Blue Theme", quantity: 1, unit_price: 40.0 }
      ]
    },
    {
      name: "Living Room – Front",
      items: [
        { item_name: "3-Seater Sofa – Velvet Grey", attribute: "Velvet Grey", quantity: 1, unit_price: 200.0 },
        { item_name: "Occasional Chair – Boucle White", attribute: "White Boucle", quantity: 2, unit_price: 45.0 },
        { item_name: "Coffee Table – Marble Oval", attribute: "Marble Top", quantity: 1, unit_price: 60.0 },
        { item_name: "Rug – Wool Jute Natural 2x3m", attribute: "Jute 2x3m", quantity: 1, unit_price: 75.0 },
        { item_name: "Side Table – Walnut Round", attribute: "Walnut", quantity: 1, unit_price: 15.0 },
        { item_name: "Living Room Decor Bundle", attribute: "Gold/Beige", quantity: 1, unit_price: 60.0 }
      ]
    },
    {
      name: "Living Room – Main",
      items: [
        { item_name: "2.5-Seater Sofa – Linen Beige", attribute: "Linen Beige", quantity: 1, unit_price: 180.0 },
        { item_name: "Occasional Chair – Boucle White", attribute: "White Boucle", quantity: 2, unit_price: 45.0 },
        { item_name: "Coffee Table – Marble Oval", attribute: "Marble Top", quantity: 1, unit_price: 60.0 },
        { item_name: "Rug – Wool Jute Natural 2x3m", attribute: "Wool 2x3m", quantity: 1, unit_price: 75.0 },
        { item_name: "Living Room Decor Bundle", attribute: "Neutral", quantity: 1, unit_price: 60.0 }
      ]
    },
    {
      name: "Kitchen & Meals",
      items: [
        { item_name: "Dining Table – Timber 8-Seater", attribute: "8-Seater Timber", quantity: 1, unit_price: 120.0 },
        { item_name: "Dining Chair – Oak & Leather", attribute: "Black Leather", quantity: 6, unit_price: 15.0 },
        { item_name: "Prints / Mirror", attribute: "Kitchen Art", quantity: 1, unit_price: 20.0 }
      ]
    },
    {
      name: "Bathroom & Laundry",
      items: [
        { item_name: "Bed Linen & Throw Bundle", attribute: "Towel Set & Plant", quantity: 1, unit_price: 25.0 }
      ]
    },
    {
      name: "Outdoor Setting",
      items: [
        { item_name: "Dining Table – Timber 8-Seater", attribute: "Outdoor Set Table", quantity: 1, unit_price: 80.0 },
        { item_name: "Dining Chair – Oak & Leather", attribute: "Outdoor Chairs", quantity: 4, unit_price: 10.0 }
      ]
    }
  ];

  const insertRoomTemplate = await db.prepare("INSERT INTO room_templates (name, default_items) VALUES (?, ?)");
  for (const t of roomTemplates) {
    await insertRoomTemplate.run(t.name, JSON.stringify(t.items));
  }

  // 5. Seed Item Types (Warehouse Inventory)
  const itemTypes = [
    { name: "Queen Bed – Oak Frame", category: "Beds", room_tags: "Bedroom", style_tags: "Scandi, Oak", total_quantity: 12, replacement_value: 800.0, useful_life_uses: 20, photo_url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500&auto=format&fit=crop" },
    { name: "Double Bed – Fabric Frame", category: "Beds", room_tags: "Bedroom", style_tags: "Modern, Grey", total_quantity: 8, replacement_value: 600.0, useful_life_uses: 20, photo_url: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=500&auto=format&fit=crop" },
    { name: "Single Bed – Metal Frame", category: "Beds", room_tags: "Bedroom", style_tags: "Industrial", total_quantity: 6, replacement_value: 400.0, useful_life_uses: 20, photo_url: "https://images.unsplash.com/photo-1505692952047-1a78307da8f2?w=500&auto=format&fit=crop" },
    { name: "3-Seater Sofa – Velvet Grey", category: "Sofas", room_tags: "Living Room", style_tags: "Luxury, Velvet", total_quantity: 6, replacement_value: 1200.0, useful_life_uses: 15, photo_url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&auto=format&fit=crop" },
    { name: "2.5-Seater Sofa – Linen Beige", category: "Sofas", room_tags: "Living Room", style_tags: "Classic, Linen", total_quantity: 8, replacement_value: 1000.0, useful_life_uses: 15, photo_url: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=500&auto=format&fit=crop" },
    { name: "Occasional Chair – Boucle White", category: "Chairs", room_tags: "Living Room, Bedroom", style_tags: "Boucle, Scandi", total_quantity: 12, replacement_value: 350.0, useful_life_uses: 15, photo_url: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=500&auto=format&fit=crop" },
    { name: "Dining Table – Timber 8-Seater", category: "Tables", room_tags: "Dining Room, Kitchen", style_tags: "Timber, Rustic", total_quantity: 6, replacement_value: 900.0, useful_life_uses: 25, photo_url: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=500&auto=format&fit=crop" },
    { name: "Dining Chair – Oak & Leather", category: "Chairs", room_tags: "Dining Room, Kitchen", style_tags: "Oak, Leather", total_quantity: 48, replacement_value: 120.0, useful_life_uses: 25, photo_url: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=500&auto=format&fit=crop" },
    { name: "Coffee Table – Marble Oval", category: "Tables", room_tags: "Living Room", style_tags: "Marble, Luxury", total_quantity: 10, replacement_value: 450.0, useful_life_uses: 15, photo_url: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&auto=format&fit=crop" },
    { name: "Side Table – Walnut Round", category: "Tables", room_tags: "Living Room, Bedroom", style_tags: "Walnut", total_quantity: 20, replacement_value: 180.0, useful_life_uses: 15, photo_url: "https://images.unsplash.com/photo-1532372320978-9b4d8a92b243?w=500&auto=format&fit=crop" },
    { name: "Study Desk – Scandi Oak", category: "Tables", room_tags: "Study, Bedroom", style_tags: "Scandi, Oak", total_quantity: 8, replacement_value: 300.0, useful_life_uses: 20, photo_url: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500&auto=format&fit=crop" },
    { name: "Study Chair – Ergonomic Mesh", category: "Chairs", room_tags: "Study, Bedroom", style_tags: "Office, Black", total_quantity: 8, replacement_value: 150.0, useful_life_uses: 20, photo_url: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&auto=format&fit=crop" },
    { name: "Rug – Wool Jute Natural 2x3m", category: "Rugs", room_tags: "Living Room, Dining Room", style_tags: "Jute, Neutral", total_quantity: 12, replacement_value: 400.0, useful_life_uses: 10, photo_url: "https://images.unsplash.com/photo-1579656381226-5fc0f0100c3b?w=500&auto=format&fit=crop" },
    { name: "Floor Lamp – Black Metal Arc", category: "Lighting", room_tags: "Living Room, Bedroom", style_tags: "Metal, Black", total_quantity: 16, replacement_value: 120.0, useful_life_uses: 15, photo_url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop" },
    { name: "Print / Mirror – Abstract Gold", category: "Decor", room_tags: "Living Room, Bedroom, Entry", style_tags: "Gold, Abstract", total_quantity: 24, replacement_value: 150.0, useful_life_uses: 10, photo_url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop" },
    { name: "Bed Linen & Throw Bundle", category: "Decor", room_tags: "Bedroom", style_tags: "Textiles", total_quantity: 30, replacement_value: 200.0, useful_life_uses: 8, photo_url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500&auto=format&fit=crop" },
    { name: "Living Room Decor Bundle", category: "Decor", room_tags: "Living Room", style_tags: "Styling Pack", total_quantity: 20, replacement_value: 250.0, useful_life_uses: 10, photo_url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&auto=format&fit=crop" }
  ];

  const insertItemType = await db.prepare("INSERT INTO item_types (name, category, room_tags, style_tags, total_quantity, replacement_value, useful_life_uses, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertLedger = await db.prepare("INSERT INTO location_ledger (item_type_id, location_type, location_id, quantity) VALUES (?, 'warehouse', 0, ?)");

  for (const item of itemTypes) {
    const res = await insertItemType.run(item.name, item.category, item.room_tags, item.style_tags, item.total_quantity, item.replacement_value, item.useful_life_uses, item.photo_url);
    const itemTypeId = res.lastInsertRowid;
    await insertLedger.run(itemTypeId, item.total_quantity);
  }

  // 6. Seed Vehicles
  const insertVehicle = await db.prepare("INSERT INTO vehicles (name, rego, day_rate, capacity_notes) VALUES (?, ?, ?, ?)");
  await insertVehicle.run("Truck Hino 300", "STG-300", 150.0, "Holds approx 4 rooms of staging");
  await insertVehicle.run("Toyota HiAce Van", "STG-ACE", 85.0, "Holds decor and study desk sets");

  // 7. Seed initial Quotes/Jobs in various states
  const now = new Date();
  const dateStr = (offsetDays) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const insertQuote = await db.prepare(`
    INSERT INTO quotes (
      client_id, agent_id, recipient_type, creation_type, status, bill_to, flat_price, hire_duration, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertQuoteRoom = await db.prepare("INSERT INTO quote_rooms (quote_id, room_type, label) VALUES (?, ?, ?)");
  const insertQuoteLineItem = await db.prepare("INSERT INTO quote_line_items (room_id, item_name, attribute, quantity, unit_price) VALUES (?, ?, ?, ?, ?)");

  // Seed Quote 1: Draft
  const q1 = await insertQuote.run(2, null, "Client", "Send from Floorplan/Online Photos", "Draft", "Client", 2800.0, "6 Weeks", 2);
  const q1Id = q1.lastInsertRowid;
  const qr1 = await insertQuoteRoom.run(q1Id, "Bedroom – Master", "Master Bed");
  await insertQuoteLineItem.run(qr1.lastInsertRowid, "Queen Bed – Oak Frame", "Queen Size", 1, 150.0);
  await insertQuoteLineItem.run(qr1.lastInsertRowid, "Side Table – Walnut Round", "Matching Pair", 2, 30.0);

  // Seed Quote 2: Scheduled
  const q2 = await insertQuote.run(1, 1, "Real Estate Agent", "Schedule a Quote Day", "Scheduled", "Agent", 3500.0, "6 Weeks", 2);
  await db.prepare("UPDATE quotes SET visit_date = ?, visit_time = ?, visit_type = ?, visit_assigned_to = ? WHERE id = ?")
    .run(dateStr(1), "10:30 AM", "Viewing with Client", 3, q2.lastInsertRowid);

  // Seed Job 1: Live (Styled)
  // Create signed quote first
  const q3 = await insertQuote.run(1, 1, "Client", "Send from Floorplan/Online Photos", "Signed", "Client", 4500.0, "8 Weeks", 2);
  const q3Id = q3.lastInsertRowid;
  await db.prepare("UPDATE quotes SET signature_name = ?, signature_data = ?, signed_at = ? WHERE id = ?")
    .run("Arthur Dent", "draw-sig-data", dateStr(-14), q3Id);

  // Insert rooms for Q3
  const qr3_1 = await insertQuoteRoom.run(q3Id, "Bedroom – Master", "Master Bedroom");
  const qr3_1_id = qr3_1.lastInsertRowid;
  await insertQuoteLineItem.run(qr3_1_id, "Queen Bed – Oak Frame", "Queen Size", 1, 150.0);
  await insertQuoteLineItem.run(qr3_1_id, "Side Table – Walnut Round", "Walnut Round", 2, 30.0);
  await insertQuoteLineItem.run(qr3_1_id, "Bed Linen & Throw Bundle", "Grey Bundle", 1, 50.0);

  const qr3_2 = await insertQuoteRoom.run(q3Id, "Living Room – Main", "Main Lounge");
  const qr3_2_id = qr3_2.lastInsertRowid;
  await insertQuoteLineItem.run(qr3_2_id, "3-Seater Sofa – Velvet Grey", "Velvet Grey", 1, 200.0);
  await insertQuoteLineItem.run(qr3_2_id, "Coffee Table – Marble Oval", "Marble Oval", 1, 60.0);
  await insertQuoteLineItem.run(qr3_2_id, "Rug – Wool Jute Natural 2x3m", "Rug Jute", 1, 75.0);

  // Create Job
  const insertJob = await db.prepare(`
    INSERT INTO jobs (
      quote_id, client_id, agent_id, status, installation_date, is_tbc, bill_to, hire_start_date, hire_end_date, stylist_id, vehicle_id, styling_visit_date, notes
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
  `);
  const j1 = await insertJob.run(
    q3Id, 1, 1, "Styled/Live", dateStr(-13), "Client", dateStr(-13), dateStr(42), 3, 1, dateStr(-13), "Keysafe at side door code 4242"
  );
  const j1Id = j1.lastInsertRowid;

  // Allocate inventory sourcing
  const insertSourcing = await db.prepare(`
    INSERT INTO job_sourcing (
      job_id, room_name, item_name, attribute, required_quantity, item_type_id, sourced_quantity, source_type, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertSourcing.run(j1Id, "Master Bedroom", "Queen Bed – Oak Frame", "Queen Size", 1, 1, 1, "warehouse", "Sourced");
  await insertSourcing.run(j1Id, "Master Bedroom", "Side Table – Walnut Round", "Walnut Round", 2, 10, 2, "warehouse", "Sourced");
  await insertSourcing.run(j1Id, "Master Bedroom", "Bed Linen & Throw Bundle", "Grey Bundle", 1, 16, 1, "warehouse", "Sourced");
  await insertSourcing.run(j1Id, "Main Lounge", "3-Seater Sofa – Velvet Grey", "Velvet Grey", 1, 4, 1, "warehouse", "Sourced");
  await insertSourcing.run(j1Id, "Main Lounge", "Coffee Table – Marble Oval", "Marble Oval", 1, 9, 1, "warehouse", "Sourced");
  await insertSourcing.run(j1Id, "Main Lounge", "Rug – Wool Jute Natural 2x3m", "Rug Jute", 1, 13, 1, "warehouse", "Sourced");

  // Move items in location ledger
  // Subtract from warehouse, add to job
  const deductWarehouse = await db.prepare("UPDATE location_ledger SET quantity = quantity - ? WHERE item_type_id = ? AND location_type = 'warehouse'");
  const addJobLedger = await db.prepare("INSERT INTO location_ledger (item_type_id, location_type, location_id, quantity) VALUES (?, 'job', ?, ?)");

  await deductWarehouse.run(1, 1);
  await deductWarehouse.run(10, 2);
  await deductWarehouse.run(16, 1);
  await deductWarehouse.run(4, 1);
  await deductWarehouse.run(9, 1);
  await deductWarehouse.run(13, 1);

  await addJobLedger.run(1, j1Id, 1);
  await addJobLedger.run(10, j1Id, 2);
  await addJobLedger.run(16, j1Id, 1);
  await addJobLedger.run(4, j1Id, 1);
  await addJobLedger.run(9, j1Id, 1);
  await addJobLedger.run(13, j1Id, 1);

  // Add keys
  await db.prepare("INSERT INTO keys (job_id, status, current_holder, updated_at) VALUES (?, 'Picked Up', 'Crew', ?)")
    .run(j1Id, dateStr(-13));

  // Add photos
  await db.prepare("INSERT INTO photos (job_id, type, url, uploaded_by, uploaded_at, room_name) VALUES (?, 'Before', ?, 2, ?, 'Master Bedroom')")
    .run(j1Id, "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop", dateStr(-14));
  await db.prepare("INSERT INTO photos (job_id, type, url, uploaded_by, uploaded_at, room_name) VALUES (?, 'After/Completed', ?, 3, ?, 'Master Bedroom')")
    .run(j1Id, "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=500&auto=format&fit=crop", dateStr(-13));

  // Mock a Run that already happened
  const r1 = await db.prepare("INSERT INTO runs (run_date, vehicle_id, status) VALUES (?, 1, 'Completed')").run(dateStr(-13));
  const r1Id = r1.lastInsertRowid;
  await db.prepare("INSERT INTO run_staff (run_id, staff_id) VALUES (?, ?)").run(r1Id, 4);
  await db.prepare("INSERT INTO run_staff (run_id, staff_id) VALUES (?, ?)").run(r1Id, 5);

  const stop1 = await db.prepare("INSERT INTO run_stops (run_id, job_id, stop_order, stop_type, status, arrived_at, departed_at) VALUES (?, ?, 1, 'Install', 'Departed', ?, ?)")
    .run(r1Id, j1Id, `${dateStr(-13)} 08:30:00`, `${dateStr(-13)} 11:45:00`);
  const stop1Id = stop1.lastInsertRowid;

  // Insert completed checklist items
  const checklistsItems = [
    { type: 'Install Arrival', items: ['Confirm correct property/address', 'Confirm key access', 'Quick photo of the property\'s existing condition before anything is brought in'] },
    { type: 'Install Departure', items: ['Every item on the job\'s sourced list is placed in its assigned room', 'Styling matches the reference photos/quote', 'Property left clean — no packaging, offcuts, or rubbish left behind', 'Whole-crew sign-off before the stop is marked complete'] }
  ];
  for (const cList of checklistsItems) {
    for (const item of cList.items) {
      await db.prepare("INSERT INTO checklists (stop_id, run_id, type, item_text, is_checked, checked_by, checked_at) VALUES (?, ?, ?, ?, 1, 4, ?)")
        .run(stop1Id, r1Id, cList.type, item, `${dateStr(-13)} 11:30:00`);
    }
  }

  // Seed Chat Messages
  const insertChat = await db.prepare("INSERT INTO chat_messages (channel_type, job_id, sender_id, sender_name, message_text, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  await insertChat.run("global", null, 1, "Sarah Administrator", "Welcome to the Sales by Design internal chat! Use this space to coordinate staging runs.", dateStr(-1));
  await insertChat.run("global", null, 3, "Emma Stylist", "Hey Sarah, I've loaded the furniture layout for tomorrow's job. Dave, can you confirm Hino Truck capacity?", dateStr(0));
  await insertChat.run("global", null, 4, "Dave Crewman", "Yes Emma, Hino is fully prepped and ready for load-out.", dateStr(0));
  await insertChat.run("job", 1, 3, "Emma Stylist", "Arthur Dent's property styled photos are looking great! Let me know if key handovers are complete.", dateStr(-13));

  console.log("Database seeded successfully!");
}



// --- EXPRESS APP SETUP ---
const app = express();
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isLocal = origin.startsWith('http://localhost:') || 
                    origin.startsWith('http://127.0.0.1:') || 
                    origin === frontendUrl;
    if (isLocal) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Session configuration for secure token storage (Proposal system requirement)
app.use(session({
  secret: process.env.SESSION_SECRET || 'xero_default_session_secret_2026_sbd',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if running behind HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve Proposal System static files & assets
const PROPOSAL_SYSTEM_DIR = path.join(__dirname, 'Proposal system');
app.use('/Proposal system', express.static(PROPOSAL_SYSTEM_DIR));
app.use('/css', express.static(path.join(PROPOSAL_SYSTEM_DIR, 'css')));
app.use('/js', express.static(path.join(PROPOSAL_SYSTEM_DIR, 'js')));
app.use('/images', express.static(path.join(PROPOSAL_SYSTEM_DIR, 'images')));
app.use('/data', express.static(path.join(PROPOSAL_SYSTEM_DIR, 'data')));

// Clean redirect to login.html if accessing the root of Proposal system folder
app.get('/Proposal system', (req, res) => {
  res.redirect('/Proposal system/login.html');
});
app.get('/Proposal system/', (req, res) => {
  res.redirect('/Proposal system/login.html');
});

// Logging helper
const logCommunication = async (quoteId, jobId, recipient, subject, body, type = 'Email') => {
  const token = crypto.randomBytes(16).toString('hex');
  await await db.prepare(`
    INSERT INTO communications (quote_id, job_id, recipient, subject, body, type, sent_at, magic_token)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)
  `).run(quoteId, jobId, recipient, subject, body, type, token);
  return token;
};

// --- API ENDPOINTS ---

// Dashboard Analytics
await app.get('/api/dashboard', async (req, res) => {
  try {
    const dateRange = req.query.range || 'month'; // 'month' | 'quarter' | 'year' | 'all'
    let dateFilter = "AND datetime(signed_at) >= datetime('now', '-30 days')";
    if (dateRange === 'quarter') dateFilter = "AND datetime(signed_at) >= datetime('now', '-90 days')";
    else if (dateRange === 'year') dateFilter = "AND datetime(signed_at) >= datetime('now', '-365 days')";
    else if (dateRange === 'all') dateFilter = "";

    // Win counts
    const wins = await db.prepare(`SELECT COUNT(*) as count, SUM(flat_price) as value FROM quotes WHERE status = 'Signed' ${dateFilter}`).get();
    
    // Lost counts (Declined + Expired)
    const lostQuoteStage = await db.prepare(`SELECT COUNT(*) as count, SUM(flat_price) as value FROM quotes WHERE status IN ('Declined', 'Expired') ${dateFilter}`).get();
    const lostBookingStage = await db.prepare(`SELECT COUNT(*) as count FROM jobs WHERE status = 'Cancelled'`).get(); // cancelled jobs

    // Total Pipeline
    const pipeline = await db.prepare(`SELECT COUNT(*) as count, SUM(flat_price) as value FROM quotes WHERE status IN ('Draft', 'Sent', 'Viewed')`).get();

    // Lead Sources
    const leadSources = await db.prepare(`
      SELECT c.lead_source, COUNT(*) as count, SUM(q.flat_price) as value
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      WHERE q.status = 'Signed' ${dateFilter}
      GROUP BY c.lead_source
    `).all();

    // Agent Leaderboard
    const agentLeaderboard = await db.prepare(`
      SELECT a.name, a.agency, COUNT(j.id) as jobs_count, SUM(q.flat_price) as total_revenue
      FROM jobs j
      JOIN quotes q ON j.quote_id = q.id
      JOIN agents a ON j.agent_id = a.id
      WHERE j.status != 'Cancelled'
      GROUP BY a.id
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all();

    res.json({
      revenueBooked: wins.value || 0,
      jobsCount: wins.count || 0,
      pipelineValue: pipeline.value || 0,
      pipelineCount: pipeline.count || 0,
      lostQuoteCount: lostQuoteStage.count || 0,
      lostQuoteValue: lostQuoteStage.value || 0,
      lostBookingCount: lostBookingStage.count || 0,
      leadSources,
      agentLeaderboard
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Staff APIs
await app.get('/api/staff', async (req, res) => {
  try {
    const list = await db.prepare("SELECT * FROM staff WHERE active = 1").all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { name, role, phone, email, password, hourly_rate } = req.body;
    if (!name || !role || !email || !password) {
      return res.status(400).json({ error: 'Name, role, email, and password are required' });
    }

    // Check if email already exists
    const existing = await db.prepare("SELECT * FROM staff WHERE email = ?").get(email);
    if (existing) {
      return res.status(400).json({ error: 'A staff member with this email already exists' });
    }

    const result = await db.prepare(`
      INSERT INTO staff (name, role, phone, email, password, hourly_rate, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(name, role, phone || null, email, password, parseFloat(hourly_rate) || 0);

    res.json({
      success: true,
      staff: {
        id: result.lastInsertRowid,
        name,
        role,
        phone,
        email,
        hourly_rate: parseFloat(hourly_rate) || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vehicles APIs
await app.get('/api/vehicles', async (req, res) => {
  try {
    const list = await db.prepare("SELECT * FROM vehicles").all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authentication Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.prepare("SELECT * FROM staff WHERE email = ? AND active = 1").get(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Clients APIs
await app.get('/api/clients', async (req, res) => {
  try {
    const list = await db.prepare(`
      SELECT c.*, a.name as referring_agent_name, a.agency as referring_agent_agency
      FROM clients c
      LEFT JOIN agents a ON c.referring_agent_id = a.id
    `).all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { name, primary_email, secondary_emails, phone, address, lead_source, referring_agent_id, notes } = req.body;
    const result = await db.prepare(`
      INSERT INTO clients (name, primary_email, secondary_emails, phone, address, lead_source, referring_agent_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, primary_email, secondary_emails, phone, address, lead_source, referring_agent_id || null, notes);
    
    const client = await db.prepare("SELECT * FROM clients WHERE id = ?").get(result.lastInsertRowid);
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agents APIs
await app.get('/api/agents', async (req, res) => {
  try {
    const list = await db.prepare("SELECT * FROM agents").all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agents', async (req, res) => {
  try {
    const { name, agency, phone, email } = req.body;
    const result = await db.prepare("INSERT INTO agents (name, agency, phone, email) VALUES (?, ?, ?, ?)")
      .run(name, agency, phone, email);
    const agent = await db.prepare("SELECT * FROM agents WHERE id = ?").get(result.lastInsertRowid);
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Room Templates APIs
await app.get('/api/room-templates', async (req, res) => {
  try {
    const list = await db.prepare("SELECT * FROM room_templates").all();
    res.json(list.map(t => ({ ...t, default_items: JSON.parse(t.default_items) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/room-templates', async (req, res) => {
  try {
    const { name, default_items } = req.body;
    await db.prepare("INSERT INTO room_templates (name, default_items) VALUES (?, ?)")
      .run(name, JSON.stringify(default_items));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quotes APIs
await app.get('/api/quotes', async (req, res) => {
  try {
    const list = await db.prepare(`
      SELECT q.*, c.name as client_name, c.primary_email as client_email, c.address as client_address,
             a.name as agent_name, a.agency as agent_agency, s.name as creator_name
      FROM quotes q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN agents a ON q.agent_id = a.id
      LEFT JOIN staff s ON q.created_by = s.id
      ORDER BY q.id DESC
    `).all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

await app.get('/api/quotes/:id', async (req, res) => {
  try {
    const quote = await db.prepare(`
      SELECT q.*, c.name as client_name, c.primary_email as client_email, c.phone as client_phone, c.address as client_address, c.secondary_emails as client_secondary,
             a.name as agent_name, a.agency as agent_agency, a.email as agent_email
      FROM quotes q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN agents a ON q.agent_id = a.id
      WHERE q.id = ?
    `).get(req.params.id);

    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    const rooms = await db.prepare("SELECT * FROM quote_rooms WHERE quote_id = ?").all(req.params.id);
    for (const room of rooms) {
      room.line_items = await db.prepare("SELECT * FROM quote_line_items WHERE room_id = ?").all(room.id);
    }
    quote.rooms = rooms;
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quotes', async (req, res) => {
  try {
    const { client_id, agent_id, recipient_type, creation_type, bill_to, hire_duration, flat_price, created_by, visit_date, visit_time, visit_type, visit_assigned_to, rooms } = req.body;
    
    const status = creation_type === 'Schedule a Quote Day' ? 'Scheduled' : 'Draft';

    const result = await db.prepare(`
      INSERT INTO quotes (
        client_id, agent_id, recipient_type, creation_type, status, bill_to, hire_duration, flat_price, created_by,
        visit_date, visit_time, visit_type, visit_assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client_id || null, agent_id || null, recipient_type, creation_type, status, bill_to, hire_duration, flat_price || 0, created_by || 2,
      visit_date || null, visit_time || null, visit_type || null, visit_assigned_to || null
    );

    const quoteId = result.lastInsertRowid;

    if (rooms && rooms.length > 0) {
      for (const r of rooms) {
        const roomResult = await db.prepare("INSERT INTO quote_rooms (quote_id, room_type, label, notes) VALUES (?, ?, ?, ?)")
          .run(quoteId, r.room_type, r.label || r.room_type, r.notes || '');
        const roomId = roomResult.lastInsertRowid;
        if (r.line_items && r.line_items.length > 0) {
          for (const item of r.line_items) {
            await db.prepare("INSERT INTO quote_line_items (room_id, item_name, attribute, quantity, unit_price) VALUES (?, ?, ?, ?, ?)")
              .run(roomId, item.item_name, item.attribute || '', item.quantity || 1, item.unit_price || 0);
          }
        }
      }
    }

    res.json({ success: true, quoteId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/quotes/:id', async (req, res) => {
  try {
    const { status, flat_price, lost_reason, hire_duration, bill_to, rooms, visit_date, visit_time, visit_type, visit_assigned_to } = req.body;
    
    await db.prepare(`
      UPDATE quotes SET
        status = COALESCE(?, status),
        flat_price = COALESCE(?, flat_price),
        lost_reason = COALESCE(?, lost_reason),
        hire_duration = COALESCE(?, hire_duration),
        bill_to = COALESCE(?, bill_to),
        visit_date = COALESCE(?, visit_date),
        visit_time = COALESCE(?, visit_time),
        visit_type = COALESCE(?, visit_type),
        visit_assigned_to = COALESCE(?, visit_assigned_to)
      WHERE id = ?
    `).run(status, flat_price, lost_reason, hire_duration, bill_to, visit_date, visit_time, visit_type, visit_assigned_to, req.params.id);

    if (rooms) {
      // Re-populate rooms & items
      await db.prepare("DELETE FROM quote_rooms WHERE quote_id = ?").run(req.params.id);
      for (const r of rooms) {
        const roomResult = await db.prepare("INSERT INTO quote_rooms (quote_id, room_type, label, notes) VALUES (?, ?, ?, ?)")
          .run(req.params.id, r.room_type, r.label, r.notes);
        const roomId = roomResult.lastInsertRowid;
        if (r.line_items) {
          for (const item of r.line_items) {
            await db.prepare("INSERT INTO quote_line_items (room_id, item_name, attribute, quantity, unit_price) VALUES (?, ?, ?, ?, ?)")
              .run(roomId, item.item_name, item.attribute, item.quantity, item.unit_price);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quote Sending and CC agent logic (US-1.5, 3.2 step 7)
app.post('/api/quotes/:id/send', async (req, res) => {
  try {
    const { cc_agent_on_send } = req.body;
    
    await db.prepare("UPDATE quotes SET status = 'Sent', cc_agent_on_send = ? WHERE id = ?")
      .run(cc_agent_on_send ? 1 : 0, req.params.id);

    const quote = await db.prepare(`
      SELECT q.*, c.name as client_name, c.primary_email as client_email, a.name as agent_name, a.email as agent_email
      FROM quotes q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN agents a ON q.agent_id = a.id
      WHERE q.id = ?
    `).get(req.params.id);

    // Generate Client Magic Link email
    const subject = `Staging Quote for ${quote.client_name}`;
    const magicLink = `http://localhost:3000/portal/quote/${quote.id}`;
    let body = `Dear ${quote.client_name},\n\nWe have prepared a home staging quote for your property at ${quote.client_address || 'your address'}. Please review the options and sign digitally using the link below:\n\n${magicLink}\n\nKind regards,\nSales by Design Team`;
    
    const clientToken = logCommunication(quote.id, null, quote.client_email, subject, body);

    // If cc agent is active
    if (cc_agent_on_send && quote.agent_email) {
      const agentBody = `Dear ${quote.agent_name},\n\nWe have sent the staging quote to the client ${quote.client_name}. You are CC'd on this request. They can review and accept via: ${magicLink}.\n\nKind regards,\nSales by Design Team`;
      logCommunication(quote.id, null, quote.agent_email, `[CC] Staging Quote for ${quote.client_name}`, agentBody);
    }

    res.json({ success: true, clientToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sign Quote endpoint (Client Magic Portal)
app.post('/api/quotes/:id/sign', async (req, res) => {
  try {
    const { name, signature_data } = req.body;
    const signedAt = new Date().toISOString().split('T')[0];

    await db.prepare(`
      UPDATE quotes SET
        status = 'Signed',
        signature_name = ?,
        signature_data = ?,
        signed_at = ?
      WHERE id = ?
    `).run(name, signature_data, signedAt, req.params.id);

    // Get Quote Info
    const quote = await db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);

    // Auto-convert to Job
    const installDate = null; // initially null, marked as TBC
    const jobResult = await db.prepare(`
      INSERT INTO jobs (quote_id, client_id, agent_id, status, installation_date, is_tbc, bill_to, notes)
      VALUES (?, ?, ?, 'Booked', ?, 1, ?, ?)
    `).run(quote.id, quote.client_id, quote.agent_id, installDate, quote.bill_to, 'Auto-converted from signed quote.');

    const jobId = jobResult.lastInsertRowid;

    // Auto-create Chat Channel for the Job
    const clientForChat = await db.prepare("SELECT name FROM clients WHERE id = ?").get(quote.client_id);
    if (clientForChat) {
      await db.prepare("INSERT INTO chat_channels (name, type, job_id) VALUES (?, 'job', ?)").run(
        `job-${jobId}-${clientForChat.name.toLowerCase().replace(/\s+/g, '-')}`,
        jobId
      );
    }

    // Load Quote Rooms & items to prefill "Job Sourcing" (US-3.1)
    const quoteRooms = await db.prepare("SELECT * FROM quote_rooms WHERE quote_id = ?").all(quote.id);
    for (const qr of quoteRooms) {
      const lineItems = await db.prepare("SELECT * FROM quote_line_items WHERE room_id = ?").all(qr.id);
      for (const li of lineItems) {
        await db.prepare(`
          INSERT INTO job_sourcing (job_id, room_name, item_name, attribute, required_quantity, status)
          VALUES (?, ?, ?, ?, ?, 'Not Sourced')
        `).run(jobId, qr.label, li.item_name, li.attribute, li.quantity);
      }
    }

    // Trigger confirmation communication log
    const client = await db.prepare("SELECT name, primary_email FROM clients WHERE id = ?").get(quote.client_id);
    logCommunication(quote.id, jobId, client.primary_email, `Agreement Received - Booking Confirmed`, `Dear ${client.name},\n\nThank you for signing the agreement! Your staging booking is now confirmed. We will set the installation schedule shortly.`);

    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Jobs APIs
await app.get('/api/jobs', async (req, res) => {
  try {
    const list = await db.prepare(`
      SELECT j.*, c.name as client_name, c.primary_email as client_email, c.phone as client_phone, c.address as client_address,
             a.name as agent_name, a.agency as agent_agency, a.phone as agent_phone, q.flat_price as quote_price,
             s.name as stylist_name, v.name as vehicle_name
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      LEFT JOIN agents a ON j.agent_id = a.id
      LEFT JOIN quotes q ON j.quote_id = q.id
      LEFT JOIN staff s ON j.stylist_id = s.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      ORDER BY j.id DESC
    `).all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

await app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await db.prepare(`
      SELECT j.*, c.name as client_name, c.primary_email as client_email, c.phone as client_phone, c.address as client_address, c.secondary_emails as client_secondary,
             a.name as agent_name, a.agency as agent_agency, a.phone as agent_phone, a.email as agent_email, q.flat_price as quote_price, q.hire_duration,
             s.name as stylist_name, v.name as vehicle_name
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      LEFT JOIN agents a ON j.agent_id = a.id
      LEFT JOIN quotes q ON j.quote_id = q.id
      LEFT JOIN staff s ON j.stylist_id = s.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      WHERE j.id = ?
    `).get(req.params.id);

    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Fetch Sourced Sourcing lines
    const sourcing = await db.prepare("SELECT * FROM job_sourcing WHERE job_id = ?").all(req.params.id);
    job.sourcing = sourcing;

    // Fetch checklists linked
    const stops = await db.prepare("SELECT * FROM run_stops WHERE job_id = ?").all(req.params.id);
    job.stops = stops;

    // Fetch Keys
    const keys = await db.prepare("SELECT * FROM keys WHERE job_id = ?").all(req.params.id);
    job.keys = keys;

    // Fetch Photos
    const photos = await db.prepare("SELECT * FROM photos WHERE job_id = ?").all(req.params.id);
    job.photos = photos;

    // Fetch Damage Records
    const damages = await db.prepare("SELECT * FROM damage_records WHERE job_id = ?").all(req.params.id);
    job.damage_records = damages;

    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Job Schedule (US-1.7, 3.6)
app.post('/api/jobs/:id/schedule', async (req, res) => {
  try {
    const { installation_date, is_tbc } = req.body;
    let status = 'Confirmed';
    if (!is_tbc && installation_date) {
      status = 'Install Scheduled';
    }

    await db.prepare(`
      UPDATE jobs SET
        installation_date = ?,
        is_tbc = ?,
        status = ?,
        hire_start_date = COALESCE(hire_start_date, ?)
      WHERE id = ?
    `).run(installation_date || null, is_tbc ? 1 : 0, status, installation_date || null, req.params.id);

    // If confirmed with installation date, calculate hire_end_date (e.g. 6/8 weeks)
    if (!is_tbc && installation_date) {
      const job = await db.prepare("SELECT j.*, q.hire_duration FROM jobs j JOIN quotes q ON j.quote_id = q.id WHERE j.id = ?").get(req.params.id);
      let weeks = 6;
      if (job.hire_duration === '8 Weeks') weeks = 8;
      const start = new Date(installation_date);
      start.setDate(start.getDate() + (weeks * 7));
      const endDate = start.toISOString().split('T')[0];

      await db.prepare("UPDATE jobs SET hire_end_date = ? WHERE id = ?").run(endDate, req.params.id);

      // Log email trigger
      const client = await db.prepare("SELECT name, primary_email FROM clients WHERE id = ?").get(job.client_id);
      logCommunication(job.quote_id, job.id, client.primary_email, `Installation Date Scheduled`, `Dear ${client.name},\n\nWe have scheduled your styling installation for ${installation_date}. Our removalist crew will arrive on site that morning.\n\nWarm regards,\nSales by Design Team`);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign Stylist & Logistics Details (Section 7)
app.post('/api/jobs/:id/logistics', async (req, res) => {
  try {
    const { stylist_id, vehicle_id, styling_visit_date } = req.body;
    await db.prepare(`
      UPDATE jobs SET
        stylist_id = COALESCE(?, stylist_id),
        vehicle_id = COALESCE(?, vehicle_id),
        styling_visit_date = COALESCE(?, styling_visit_date)
      WHERE id = ?
    `).run(stylist_id || null, vehicle_id || null, styling_visit_date || null, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inventory Sourcing availability checking and conflict management (US-3.2, 3.3)
await app.get('/api/inventory/availability', async (req, res) => {
  try {
    const { item_type_id, start_date, end_date, current_job_id } = req.query;

    const item = await db.prepare("SELECT * FROM item_types WHERE id = ?").get(item_type_id);
    if (!item) return res.status(404).json({ error: 'Item type not found' });

    // Sum allocated stock for overlapping dates
    // Any job overlaps if job.hire_start_date <= end_date AND job.hire_end_date >= start_date
    const allocations = await db.prepare(`
      SELECT SUM(js.required_quantity) as qty, j.id as job_id, j.status as job_status, c.name as client_name
      FROM job_sourcing js
      JOIN jobs j ON js.job_id = j.id
      JOIN clients c ON j.client_id = c.id
      WHERE js.item_type_id = ?
        AND js.needs_attention_resolved = 0
        AND j.status NOT IN ('Completed', 'Cancelled', 'Ended')
        AND j.hire_start_date <= ?
        AND j.hire_end_date >= ?
        AND j.id != ?
      GROUP BY j.id
    `).all(item_type_id, end_date, start_date, current_job_id || 0);

    const totalAllocated = allocations.reduce((acc, a) => acc + (a.qty || 0), 0);
    const available = item.total_quantity - totalAllocated;

    res.json({
      item_type_id: parseInt(item_type_id),
      name: item.name,
      total_owned: item.total_quantity,
      allocated_count: totalAllocated,
      available_count: available,
      allocations // list of other jobs holding reservations to check soft vs hard conflicts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Source a specific item (US-3.2)
app.post('/api/jobs/:id/source-item', async (req, res) => {
  try {
    const { sourcing_id, item_type_id, source_type, source_job_id } = req.body;
    
    // Status is 'Sourced' immediately for warehouse, 'Pending Arrival' for de-stage pickup
    const status = source_type === 'warehouse' ? 'Sourced' : 'Pending Arrival';

    await db.prepare(`
      UPDATE job_sourcing SET
        item_type_id = ?,
        source_type = ?,
        source_job_id = ?,
        sourced_quantity = required_quantity,
        status = ?
      WHERE id = ? AND job_id = ?
    `).run(item_type_id, source_type, source_job_id || null, status, sourcing_id, req.params.id);

    // If warehouse, deduct from ledger warehouse, and add to ledger job
    if (source_type === 'warehouse') {
      const line = await db.prepare("SELECT * FROM job_sourcing WHERE id = ?").get(sourcing_id);
      
      // Deduct warehouse ledger
      await db.prepare("UPDATE location_ledger SET quantity = quantity - ? WHERE item_type_id = ? AND location_type = 'warehouse'")
        .run(line.sourced_quantity, item_type_id);

      // Add/update job ledger
      const jobLedger = await db.prepare("SELECT * FROM location_ledger WHERE item_type_id = ? AND location_type = 'job' AND location_id = ?")
        .get(item_type_id, req.params.id);
      if (jobLedger) {
        await db.prepare("UPDATE location_ledger SET quantity = quantity + ? WHERE id = ?")
          .run(line.sourced_quantity, jobLedger.id);
      } else {
        await db.prepare("INSERT INTO location_ledger (item_type_id, location_type, location_id, quantity) VALUES (?, 'job', ?, ?)")
          .run(item_type_id, req.params.id, line.sourced_quantity);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sourcing picker helpers
await app.get('/api/inventory/catalog', async (req, res) => {
  try {
    const list = await db.prepare("SELECT * FROM item_types").all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Flag item as Needs Attention (US-3.4)
app.post('/api/jobs/:id/needs-attention', async (req, res) => {
  try {
    const { sourcing_id, reason, notes } = req.body;
    await db.prepare(`
      UPDATE job_sourcing SET
        status = 'Needs Attention',
        needs_attention_reason = ?,
        needs_attention_note = ?,
        needs_attention_resolved = 0
      WHERE id = ? AND job_id = ?
    `).run(reason, notes || '', sourcing_id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve Needs Attention flag (US-3.4)
app.post('/api/jobs/:id/resolve-attention', async (req, res) => {
  try {
    const { sourcing_id, resolver_id, note } = req.body;
    const dateStr = new Date().toISOString();
    
    await db.prepare(`
      UPDATE job_sourcing SET
        status = 'Sourced',
        needs_attention_resolved = 1,
        needs_attention_resolved_by = ?,
        needs_attention_resolved_at = ?,
        needs_attention_note = COALESCE(?, needs_attention_note)
      WHERE id = ? AND job_id = ?
    `).run(resolver_id || 1, dateStr, note, sourcing_id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Item Catalog (US-5)
app.post('/api/inventory/catalog', async (req, res) => {
  try {
    const { name, category, room_tags, style_tags, total_quantity, replacement_value, useful_life_uses, photo_url, condition_notes } = req.body;
    const result = await db.prepare(`
      INSERT INTO item_types (name, category, room_tags, style_tags, total_quantity, replacement_value, useful_life_uses, photo_url, condition_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, category, room_tags || '', style_tags || '', total_quantity || 0, replacement_value || 0, useful_life_uses || 10, photo_url || null, condition_notes || '');
    
    const id = result.lastInsertRowid;
    // Put all in warehouse ledger
    await db.prepare("INSERT INTO location_ledger (item_type_id, location_type, location_id, quantity) VALUES (?, 'warehouse', 0, ?)")
      .run(id, total_quantity || 0);

    res.json({ success: true, itemTypeId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End of Hire Tracker endpoints (US-6.3, Section 10)
await app.get('/api/end-of-hire', async (req, res) => {
  try {
    const list = await db.prepare(`
      SELECT j.id, j.status, j.hire_start_date, j.hire_end_date, j.extension_type, j.property_sold,
             c.name as client_name, c.address as client_address, q.flat_price as quote_price
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      JOIN quotes q ON j.quote_id = q.id
      WHERE j.status NOT IN ('Completed', 'Cancelled', 'Ended')
      ORDER BY j.hire_end_date ASC
    `).all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/extend-hire', async (req, res) => {
  try {
    const { new_end_date, extension_type } = req.body;
    await db.prepare(`
      UPDATE jobs SET
        hire_end_date = COALESCE(?, hire_end_date),
        extension_type = ?,
        status = 'Extended'
      WHERE id = ?
    `).run(new_end_date || null, extension_type, req.params.id);

    // Verify stock availability overlaps for future dates
    // Find all item allocations for this job
    const allocations = await db.prepare("SELECT * FROM job_sourcing WHERE job_id = ? AND item_type_id IS NOT NULL").all(req.params.id);
    const conflicts = [];
    for (const alloc of allocations) {
      // Find jobs expecting this item code before the new extension end
      const overlap = await db.prepare(`
        SELECT js.job_id, j.installation_date, c.name as client_name, js.item_name
        FROM job_sourcing js
        JOIN jobs j ON js.job_id = j.id
        JOIN clients c ON j.client_id = c.id
        WHERE js.item_type_id = ?
          AND js.source_type = 'pickup'
          AND js.source_job_id = ?
          AND j.status NOT IN ('Completed', 'Cancelled', 'Ended')
      `).all(alloc.item_type_id, req.params.id);

      for (const o of overlap) {
        conflicts.push({
          jobId: o.job_id,
          installationDate: o.installation_date,
          client: o.client_name,
          item: o.item_name
        });
      }
    }

    res.json({ success: true, conflicts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark Property Sold & Schedule De-stage (US-6.3, Section 10)
app.post('/api/jobs/:id/sold', async (req, res) => {
  try {
    const { deinstall_date } = req.body;
    await db.prepare(`
      UPDATE jobs SET
        property_sold = 1,
        status = 'De-install Scheduled',
        hire_end_date = COALESCE(?, hire_end_date)
      WHERE id = ?
    `).run(deinstall_date || null, req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logistics & Run Assignments (Section 7, US-5.1, 5.2)
await app.get('/api/logistics/day', async (req, res) => {
  try {
    const date = req.query.date; // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: 'Date is required' });

    // Installs scheduled for this day
    const installs = await db.prepare(`
      SELECT j.id, j.status, j.installation_date, c.name as client_name, c.address as client_address,
             s.name as stylist_name, v.name as vehicle_name,
             (SELECT COUNT(*) FROM job_sourcing WHERE job_id = j.id AND status = 'Needs Attention') as needs_attention_count,
             (SELECT COUNT(*) FROM job_sourcing WHERE job_id = j.id AND status = 'Not Sourced') as not_sourced_count
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      LEFT JOIN staff s ON j.stylist_id = s.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      WHERE j.installation_date = ? AND j.status != 'Cancelled'
    `).all(date);

    // De-installs / Pickups scheduled for this day (sold or hire ended)
    const pickups = await db.prepare(`
      SELECT j.id, j.status, j.hire_end_date as deinstall_date, c.name as client_name, c.address as client_address,
             s.name as stylist_name, v.name as vehicle_name
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      LEFT JOIN staff s ON j.stylist_id = s.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      WHERE j.hire_end_date = ? AND j.status = 'De-install Scheduled'
    `).all(date);

    // Runs created for this day
    const runsList = await db.prepare("SELECT * FROM runs WHERE run_date = ?").all(date);
    for (const r of runsList) {
      r.vehicle = await db.prepare("SELECT * FROM vehicles WHERE id = ?").get(r.vehicle_id);
      r.crew = await db.prepare(`
        SELECT s.* FROM staff s
        JOIN run_staff rs ON s.id = rs.staff_id
        WHERE rs.run_id = ?
      `).all(r.id);
      r.stops = await db.prepare(`
        SELECT rs.*, c.name as client_name, c.address as client_address
        FROM run_stops rs
        JOIN jobs j ON rs.job_id = j.id
        JOIN clients c ON j.client_id = c.id
        WHERE rs.run_id = ?
        ORDER BY rs.stop_order ASC
      `).all(r.id);
    }

    res.json({ installs, pickups, runs: runsList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Run Sheet (US-5.2)
app.post('/api/logistics/runs', async (req, res) => {
  try {
    const { run_date, vehicle_id, crew_ids, stops } = req.body;
    
    const runResult = await db.prepare("INSERT INTO runs (run_date, vehicle_id, status) VALUES (?, ?, 'Planned')")
      .run(run_date, vehicle_id);
    const runId = runResult.lastInsertRowid;

    // Save staff crew
    if (crew_ids && crew_ids.length > 0) {
      for (const sId of crew_ids) {
        await db.prepare("INSERT INTO run_staff (run_id, staff_id) VALUES (?, ?)").run(runId, sId);
      }
    }

    // Save stops & seed default checklists
    if (stops && stops.length > 0) {
      // Seed general warehouse departure checklist once per run (Appendix B)
      const whItems = [
        'All Warehouse-sourced items for today\'s jobs loaded, checked against each job\'s sourced list',
        'Any items still flagged Needs Attention resolved or explicitly escalated before leaving',
        'All keys needed for today\'s stops accounted for',
        'Tools/equipment loaded: furniture blankets/pads, moving straps, dolly/trolley, basic tool kit',
        'Vehicle pre-departure check: fuel level and visual check',
        'Loading order matches today\'s stop order — last on, first off',
        'All assigned crew members present and confirmed'
      ];
      for (const item of whItems) {
        await db.prepare("INSERT INTO checklists (run_id, type, item_text) VALUES (?, 'Warehouse Departure', ?)")
          .run(runId, item);
      }

      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        const stopResult = await db.prepare(`
          INSERT INTO run_stops (run_id, job_id, stop_order, stop_type)
          VALUES (?, ?, ?, ?)
        `).run(runId, s.job_id, i + 1, s.stop_type);
        const stopId = stopResult.lastInsertRowid;

        // Seed checklists (Appendix B)
        let arrivalItems = [];
        let departureItems = [];
        if (s.stop_type === 'Install') {
          arrivalItems = ['Confirm correct property/address', 'Confirm key access', 'Quick photo of existing condition'];
          departureItems = ['Every item sourced is placed in rooms', 'Styling matches reference layout', 'Property left clean - no rubbish', 'Any damage noticed logged & photographed', 'Keys handled, status updated', 'Delivery photos taken per room', 'Whole-crew sign-off'];
        } else {
          arrivalItems = ['Confirm correct property/address', 'Confirm key access', 'Quick photo before starting removal', 'Confirm expected item list - flag discrepancy'];
          departureItems = ['All listed items collected & loaded', 'Any damage to furniture/property logged & photographed', 'Property left clean, final walkthrough done', 'Keys returned, status updated', 'Whole-crew sign-off'];
        }

        for (const item of arrivalItems) {
          await db.prepare("INSERT INTO checklists (stop_id, run_id, type, item_text) VALUES (?, ?, ?, ?)")
            .run(stopId, runId, `${s.stop_type} Arrival`, item);
        }
        for (const item of departureItems) {
          await db.prepare("INSERT INTO checklists (stop_id, run_id, type, item_text) VALUES (?, ?, ?, ?)")
            .run(stopId, runId, `${s.stop_type} Departure`, item);
        }
      }
    }

    res.json({ success: true, runId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run execution APIs for Crew (US-5.3, 5.4, 5.5)
await app.get('/api/runs/staff/:staff_id', async (req, res) => {
  try {
    // Get runs involving this staff member
    const runsList = await db.prepare(`
      SELECT r.*, v.name as vehicle_name, v.rego as vehicle_rego
      FROM runs r
      JOIN run_staff rs ON r.id = rs.run_id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE rs.staff_id = ?
      ORDER BY r.run_date DESC
    `).all(req.params.staff_id);

    for (const r of runsList) {
      r.crew = await db.prepare(`
        SELECT s.* FROM staff s
        JOIN run_staff rs ON s.id = rs.staff_id
        WHERE rs.run_id = ?
      `).all(r.id);
      r.stops = await db.prepare(`
        SELECT rs.*, c.name as client_name, c.phone as client_phone, c.address as client_address,
               a.name as agent_name, a.phone as agent_phone,
               (SELECT current_holder FROM keys WHERE job_id = rs.job_id LIMIT 1) as key_holder,
               (SELECT status FROM keys WHERE job_id = rs.job_id LIMIT 1) as key_status
        FROM run_stops rs
        JOIN jobs j ON rs.job_id = j.id
        JOIN clients c ON j.client_id = c.id
        LEFT JOIN agents a ON j.agent_id = a.id
        WHERE rs.run_id = ?
        ORDER BY rs.stop_order ASC
      `).all(r.id);
      
      // Warehouse Departure Checklist
      r.warehouse_checklist = await db.prepare("SELECT * FROM checklists WHERE run_id = ? AND type = 'Warehouse Departure'").all(r.id);
    }

    res.json(runsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

await app.get('/api/runs/:run_id/stops/:stop_id', async (req, res) => {
  try {
    const stop = await db.prepare(`
      SELECT rs.*, j.notes as job_notes, j.installation_date, c.name as client_name, c.phone as client_phone, c.address as client_address,
             a.name as agent_name, a.phone as agent_phone, a.email as agent_email
      FROM run_stops rs
      JOIN jobs j ON rs.job_id = j.id
      JOIN clients c ON j.client_id = c.id
      LEFT JOIN agents a ON j.agent_id = a.id
      WHERE rs.id = ?
    `).get(req.params.stop_id);

    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    stop.checklists = await db.prepare("SELECT * FROM checklists WHERE stop_id = ?").all(req.params.stop_id);
    stop.photos = await db.prepare("SELECT * FROM photos WHERE job_id = ?").all(stop.job_id);
    stop.keys = await db.prepare("SELECT * FROM keys WHERE job_id = ?").all(stop.job_id);

    // Sourced items to pack/unpack
    stop.sourcing = await db.prepare("SELECT * FROM job_sourcing WHERE job_id = ?").all(stop.job_id);

    res.json(stop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Checklist Item (Ticking)
app.post('/api/checklists/:id/toggle', async (req, res) => {
  try {
    const { is_checked, checked_by } = req.body;
    const timeStr = is_checked ? new Date().toISOString() : null;

    await db.prepare(`
      UPDATE checklists SET
        is_checked = ?,
        checked_by = ?,
        checked_at = ?
      WHERE id = ?
    `).run(is_checked ? 1 : 0, checked_by || null, timeStr, req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Run status (Departed etc)
app.post('/api/runs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await db.prepare("UPDATE runs SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop Arrive / Depart checklists controls (US-5.4)
app.post('/api/runs/stops/:stop_id/arrive', async (req, res) => {
  try {
    const timeStr = new Date().toISOString();
    await db.prepare("UPDATE run_stops SET status = 'Arrived', arrived_at = ? WHERE id = ?")
      .run(timeStr, req.params.stop_id);
    
    // Update linked job
    const stop = await db.prepare("SELECT * FROM run_stops WHERE id = ?").get(req.params.stop_id);
    await db.prepare("UPDATE jobs SET status = 'In Progress' WHERE id = ?").run(stop.job_id);

    res.json({ success: true, arrived_at: timeStr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/runs/stops/:stop_id/depart', async (req, res) => {
  try {
    const timeStr = new Date().toISOString();
    await db.prepare("UPDATE run_stops SET status = 'Departed', departed_at = ? WHERE id = ?")
      .run(timeStr, req.params.stop_id);
    
    const stop = await db.prepare("SELECT * FROM run_stops WHERE id = ?").get(req.params.stop_id);

    // Update job status depending on stop type
    if (stop.stop_type === 'Install') {
      await db.prepare("UPDATE jobs SET status = 'Install Scheduled' WHERE id = ?").run(stop.job_id); // styled is next
      // Sourcing lines: if pending arrival, flip to sourced now since pickup source staged is de-installed
      await db.prepare("UPDATE job_sourcing SET status = 'Sourced' WHERE job_id = ? AND status = 'Pending Arrival'")
        .run(stop.job_id);
    } else {
      await db.prepare("UPDATE jobs SET status = 'Completed' WHERE id = ?").run(stop.job_id);

      // Return items to warehouse ledger
      const jobSourced = await db.prepare("SELECT * FROM job_sourcing WHERE job_id = ? AND item_type_id IS NOT NULL").all(stop.job_id);
      for (const js of jobSourced) {
        // Add back to warehouse
        await db.prepare("UPDATE location_ledger SET quantity = quantity + ? WHERE item_type_id = ? AND location_type = 'warehouse'")
          .run(js.sourced_quantity, js.item_type_id);
        // Remove from job ledger
        await db.prepare("DELETE FROM location_ledger WHERE item_type_id = ? AND location_type = 'job' AND location_id = ?")
          .run(js.item_type_id, stop.job_id);
      }
    }

    res.json({ success: true, departed_at: timeStr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Styling Visit completion & Client notifications (US-4.2)
app.post('/api/jobs/:id/complete-styling', async (req, res) => {
  try {
    const { photo_url } = req.body;
    await db.prepare("UPDATE jobs SET status = 'Styled/Live' WHERE id = ?").run(req.params.id);

    if (photo_url) {
      await db.prepare("INSERT INTO photos (job_id, type, url, uploaded_by, uploaded_at) VALUES (?, 'After/Completed', ?, 3, datetime('now', 'localtime'))")
        .run(req.params.id, photo_url);
    }

    const job = await db.prepare(`
      SELECT j.*, c.name as client_name, c.primary_email as client_email, q.flat_price
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      JOIN quotes q ON j.quote_id = q.id
      WHERE j.id = ?
    `).get(req.params.id);

    // Client email completion trigger
    const subject = `Styling Completed - ${job.client_name}`;
    const body = `Dear ${job.client_name},\n\nWe have finished styling your property! The home looks absolutely beautiful. You can view the final styled photos on your secure portal using the link below:\n\nhttp://localhost:3000/portal/job/${job.id}\n\nWarm regards,\nSales by Design Team`;
    logCommunication(job.quote_id, job.id, job.client_email, subject, body);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Key handovers (Section 2, 6)
await app.get('/api/keys', async (req, res) => {
  try {
    const list = await db.prepare("SELECT k.*, c.address, c.name as client_name FROM keys k JOIN jobs j ON k.job_id = j.id JOIN clients c ON j.client_id = c.id").all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/keys', async (req, res) => {
  try {
    const { status, current_holder, photo_url } = req.body;
    const timeStr = new Date().toISOString();

    const existingKey = await db.prepare("SELECT * FROM keys WHERE job_id = ?").get(req.params.id);
    if (existingKey) {
      await db.prepare(`
        UPDATE keys SET
          status = ?,
          current_holder = ?,
          updated_at = ?,
          photo_url = COALESCE(?, photo_url)
        WHERE job_id = ?
      `).run(status, current_holder, timeStr, photo_url || null, req.params.id);
    } else {
      await db.prepare(`
        INSERT INTO keys (job_id, status, current_holder, updated_at, photo_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.params.id, status, current_holder, timeStr, photo_url || null);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Damage Logging
app.post('/api/jobs/:id/damage', async (req, res) => {
  try {
    const { description, repair_cost, recharged_to_client, photo_url } = req.body;
    await db.prepare(`
      INSERT INTO damage_records (job_id, description, repair_cost, recharged_to_client, photo_url, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(req.params.id, description, repair_cost || 0, recharged_to_client ? 1 : 0, photo_url || null);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Communications Logs Simulator (US-0.2)
await app.get('/api/communications', async (req, res) => {
  try {
    const logs = await db.prepare("SELECT * FROM communications ORDER BY id DESC").all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mock Image Upload (Base64 -> File on disk)
app.post('/api/upload', async (req, res) => {
  try {
    const { image } = req.body; // base64 representation
    if (!image) return res.status(400).json({ error: 'Image data is required' });

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }

    const type = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const extension = type.split('/')[1] || 'png';
    const filename = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filepath, data);
    res.json({ url: `/uploads/${filename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Invoicing Sync Simulator (Xero Mock)
app.post('/api/xero-mock/sync', async (req, res) => {
  try {
    const { id, type } = req.body; // id is quote_id or job_id
    res.json({
      success: true,
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      amount_synced: type === 'quote' ? 3500 : 4500,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Job Profitability aggregation (Epic 9, US-9.1, 9.2)
await app.get('/api/profitability/jobs', async (req, res) => {
  try {
    const list = await db.prepare(`
      SELECT j.id, c.name as client_name, c.address as client_address, j.status,
             q.flat_price as revenue,
             q.hire_duration,
             s.name as stylist_name
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      JOIN quotes q ON j.quote_id = q.id
      LEFT JOIN staff s ON j.stylist_id = s.id
      WHERE j.status != 'Cancelled'
    `).all();

    const output = await Promise.all(list.map(async job => {
      // Calculate Labour Cost: crew hours * hourly_rate
      // Logged in run_stops departed_at and arrived_at
      const runs = await db.prepare(`
        SELECT rs.arrived_at, rs.departed_at, r.id as run_id
        FROM run_stops rs
        JOIN runs r ON rs.run_id = r.id
        WHERE rs.job_id = ? AND rs.status = 'Departed'
      `).all(job.id);

      let totalLabourCost = 0;
      let totalLoggedHours = 0;

      for (const run of runs) {
        const start = new Date(run.arrived_at);
        const end = new Date(run.departed_at);
        const hours = Math.abs(end - start) / 36e5; // Convert milliseconds to hours
        totalLoggedHours += hours;

        // Get crew for this run
        const crew = await db.prepare(`
          SELECT s.hourly_rate FROM staff s
          JOIN run_staff rs ON s.id = rs.staff_id
          WHERE rs.run_id = ?
        `).all(run.run_id);

        const sumRates = crew.reduce((acc, c) => acc + (c.hourly_rate || 0), 0);
        totalLabourCost += hours * sumRates;
      }

      // Add default styling prep time: Stylist hourly rate * 3 hours
      const stylist = await db.prepare("SELECT hourly_rate FROM staff WHERE role = 'Stylist'").get();
      if (stylist) {
        totalLabourCost += 3 * stylist.hourly_rate; // 3 hours of warehouse staging/planning
      }

      // Calculate Vehicle Cost: flat vehicle day rate * runs staged/de-staged
      // (a job runs in install day and pickup day, so vehicle runs count)
      const vehicleRuns = await db.prepare(`
        SELECT COUNT(DISTINCT r.id) as run_count, SUM(v.day_rate) as total_v_rate
        FROM run_stops rs
        JOIN runs r ON rs.run_id = r.id
        JOIN vehicles v ON r.vehicle_id = v.id
        WHERE rs.job_id = ?
      `).get(job.id);

      const vehicleCost = (vehicleRuns.run_count || 0) * (vehicleRuns.total_v_rate / (vehicleRuns.run_count || 1) || 150.0);

      // Calculate Inventory Cost: sum of replacement_value / useful_life_uses
      const sourcing = await db.prepare("SELECT item_type_id, required_quantity FROM job_sourcing WHERE job_id = ? AND item_type_id IS NOT NULL").all(job.id);
      let inventoryCost = 0;
      for (const s of sourcing) {
        const item = await db.prepare("SELECT replacement_value, useful_life_uses FROM item_types WHERE id = ?").get(s.item_type_id);
        if (item) {
          inventoryCost += (item.replacement_value / (item.useful_life_uses || 10)) * s.required_quantity;
        }
      }

      // Damage cost: repair costs not recharged to client
      const damage = await db.prepare("SELECT SUM(repair_cost) as cost FROM damage_records WHERE job_id = ? AND recharged_to_client = 0").get(job.id);
      const damageCost = damage.cost || 0;

      // Extensions revenue
      const extensions = job.status === 'Extended' ? 450.0 : 0; // Mock additional extension revenue
      const totalRevenue = job.revenue + extensions;

      const totalCost = totalLabourCost + vehicleCost + inventoryCost + damageCost;
      const profit = totalRevenue - totalCost;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return {
        id: job.id,
        client: job.client_name,
        address: job.client_address,
        status: job.status,
        revenue: totalRevenue,
        costs: {
          labour: Math.round(totalLabourCost),
          vehicle: Math.round(vehicleCost),
          inventory: Math.round(inventoryCost),
          damage: Math.round(damageCost),
          total: Math.round(totalCost)
        },
        profit: Math.round(profit),
        margin: Math.round(margin * 10) / 10
      };
    }));

    res.json(output);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat APIs
app.get('/api/chat/channels', async (req, res) => {
  try {
    const { staff_id } = req.query;
    if (!staff_id) {
      return res.status(400).json({ error: 'staff_id is required' });
    }

    // Select global channels, job channels, and any direct/group channels where user is a member
    const list = await db.prepare(`
      SELECT c.*, MAX(m.id) as last_message_id, MAX(m.created_at) as last_message_time
      FROM chat_channels c
      LEFT JOIN chat_messages m ON c.id = m.channel_id
      WHERE c.type = 'global' 
         OR c.type = 'job'
         OR c.id IN (SELECT channel_id FROM channel_members WHERE staff_id = ?)
      GROUP BY c.id
      ORDER BY c.type DESC, c.name ASC
    `).all(staff_id);

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/channels', async (req, res) => {
  try {
    const { name, type, members, created_by } = req.body;
    if (!name || !type || !created_by) {
      return res.status(400).json({ error: 'Name, type, and created_by are required' });
    }

    const result = await db.prepare(`
      INSERT INTO chat_channels (name, type, created_by)
      VALUES (?, ?, ?)
    `).run(name, type, created_by);

    const channelId = result.lastInsertRowid;

    // Add members if provided
    if (Array.isArray(members)) {
      // Ensure the creator is a member
      const allMembers = Array.from(new Set([...members, created_by]));
      for (const mId of allMembers) {
        await db.prepare(`
          INSERT OR IGNORE INTO channel_members (channel_id, staff_id)
          VALUES (?, ?)
        `).run(channelId, mId);
      }
    }

    const newChannel = {
      id: channelId,
      name,
      type,
      created_by,
      created_at: new Date().toISOString()
    };

    res.json(newChannel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chat/messages/:channel_id', async (req, res) => {
  try {
    const { channel_id } = req.params;
    const list = await db.prepare(`
      SELECT * FROM chat_messages 
      WHERE channel_id = ? 
      ORDER BY id ASC
    `).all(channel_id);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/messages/:channel_id', async (req, res) => {
  try {
    const { channel_id } = req.params;
    const { sender_id, sender_name, message_text } = req.body;

    if (!sender_name || !message_text) {
      return res.status(400).json({ error: 'Sender name and message text are required' });
    }

    const result = await db.prepare(`
      INSERT INTO chat_messages (channel_id, sender_id, sender_name, message_text)
      VALUES (?, ?, ?, ?)
    `).run(channel_id, sender_id || null, sender_name, message_text);

    const newMessage = {
      id: result.lastInsertRowid,
      channel_id: Number(channel_id),
      sender_id: sender_id || null,
      sender_name,
      message_text,
      created_at: new Date().toISOString()
    };

    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calendar APIs
app.get('/api/calendar-events', async (req, res) => {
  try {
    const list = await db.prepare("SELECT * FROM calendar_events ORDER BY event_date ASC, start_time ASC").all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendar-events', async (req, res) => {
  try {
    const { title, description, event_date, start_time, color, created_by } = req.body;
    if (!title || !event_date) {
      return res.status(400).json({ error: 'Title and event_date are required' });
    }

    const result = await db.prepare(`
      INSERT INTO calendar_events (title, description, event_date, start_time, color, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, description || '', event_date, start_time || '', color || 'var(--primary)', created_by || null);

    const newEvent = {
      id: result.lastInsertRowid,
      title,
      description,
      event_date,
      start_time,
      color: color || 'var(--primary)',
      created_by
    };
    res.json(newEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/calendar-events/:id', async (req, res) => {
  try {
    const { title, description, event_date, start_time, color } = req.body;
    await db.prepare(`
      UPDATE calendar_events SET
        title = ?,
        description = ?,
        event_date = ?,
        start_time = ?,
        color = ?
      WHERE id = ?
    `).run(title, description, event_date, start_time, color, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/calendar-events/:id', async (req, res) => {
  try {
    await db.prepare("DELETE FROM calendar_events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


/* =========================================================================
   Proposal System OAuth 2.0 and API Routes
   ========================================================================= */

// Middleware to ensure Xero connectivity and handle automatic token refresh
async function checkXeroToken(req, res, next) {
  if (!xeroAvailable) {
    return res.status(503).json({ 
      error: 'Xero integration is currently disabled because the Xero SDK is not installed.' 
    });
  }
  if (!req.session.tokenSet || !req.session.activeTenantId) {
    return res.status(401).json({ 
      error: 'Not connected to Xero. Please authenticate at /auth/connect' 
    });
  }
  
  const tokenSet = req.session.tokenSet;
  xero.setTokenSet(tokenSet);
  
  // Check token expiration
  const expired = new Date() > new Date(tokenSet.expires_at * 1000);
  if (expired) {
    try {
      console.log('Xero access token expired. Refreshing token...');
      const refreshedTokenSet = await xero.refreshToken();
      req.session.tokenSet = refreshedTokenSet;
      xero.setTokenSet(refreshedTokenSet);
      console.log('Xero access token refreshed successfully.');
    } catch (err) {
      console.error('Failed to refresh Xero token:', err);
      // Clear session so the user must authenticate again
      req.session.destroy();
      return res.status(401).json({ 
        error: 'Xero session expired. Please re-authenticate at /auth/connect' 
      });
    }
  }
  next();
}

// 1. Connect Route: Redirects to Xero's consent page
app.get('/auth/connect', async (req, res) => {
  if (!xeroAvailable) {
    return res.status(503).send('Xero integration is disabled because the Xero SDK is not installed.');
  }
  try {
    const consentUrl = await xero.buildConsentUrl();
    res.redirect(consentUrl);
  } catch (err) {
    console.error('Error building consent URL:', err);
    res.status(500).send('Error starting Xero authentication flow.');
  }
});

// 2. Callback Route: Exchanges authorization code for access token
app.get('/auth/callback', async (req, res) => {
  if (!xeroAvailable) {
    return res.status(503).send('Xero integration is disabled because the Xero SDK is not installed.');
  }
  try {
    const tokenSet = await xero.apiCallback(req.url);
    req.session.tokenSet = tokenSet;
    
    // Retrieve and set the active Tenant (organization) ID
    await xero.updateTenants();
    if (xero.tenants.length === 0) {
      return res.status(400).send('No authorized Xero organizations found.');
    }
    
    // Default to the first authorized organization tenant
    const activeTenant = xero.tenants[0];
    req.session.activeTenantId = activeTenant.id;
    req.session.tenantName = activeTenant.tenantName;
    
    console.log(`Connected to Xero organization: ${activeTenant.tenantName} (${activeTenant.id})`);
    
    // Redirect back to frontend dashboard
    res.redirect(`${frontendUrl}/Proposal system/dashboard.html?connected=true`);
  } catch (err) {
    console.error('Error in Xero OAuth callback:', err);
    res.status(500).send('Xero authentication failed.');
  }
});

// 3. Status Route: Returns connection state to the frontend
app.get('/auth/status', (req, res) => {
  if (!xeroAvailable) {
    return res.json({ connected: false, disabled: true });
  }
  if (req.session.tokenSet && req.session.activeTenantId) {
    res.json({
      connected: true,
      tenantName: req.session.tenantName
    });
  } else {
    res.json({ connected: false });
  }
});

// 4. Disconnect Route: Clear Xero session data
app.get('/auth/disconnect', (req, res) => {
  if (!xeroAvailable) {
    return res.json({ success: true, message: 'Xero SDK not installed, session is already disconnected.' });
  }
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy failed:', err);
      return res.status(500).json({ error: 'Failed to disconnect session.' });
    }
    res.json({ success: true, message: 'Disconnected from Xero.' });
  });
});

// Create Xero Invoice and Retrieve Online Gateway URL
app.post('/api/xero/invoice', checkXeroToken, async (req, res) => {
  const proposal = req.body;
  const tenantId = req.session.activeTenantId;
  
  if (!proposal || !proposal.id || !proposal.price) {
    return res.status(400).json({ error: 'Invalid proposal payload.' });
  }
  
  try {
    let contactId = null;
    const email = proposal.clientEmail;
    
    // 1. Search for existing contact in Xero by email
    const getContactsResponse = await xero.accountingApi.getContacts(tenantId, null, `EmailAddress=="${email}"`);
    const contacts = getContactsResponse.body.contacts;
    
    if (contacts && contacts.length > 0) {
      contactId = contacts[0].contactID;
      console.log(`Matching Contact found: ${contacts[0].name} (${contactId})`);
    } else {
      // Split client name to first and last name safely
      const nameParts = proposal.clientName ? proposal.clientName.trim().split(/\s+/) : ['Client'];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || 'Staging';
      
      const newContact = {
        name: proposal.clientName || 'Unnamed Client',
        firstName,
        lastName,
        emailAddress: email,
        phones: proposal.clientPhone ? [{ phoneType: 'DEFAULT', phoneNumber: proposal.clientPhone }] : [],
        addresses: [
          {
            addressType: 'POBOX', // Billing
            addressLine1: proposal.billingAddress?.line1 || '',
            city: proposal.billingAddress?.city || '',
            region: proposal.billingAddress?.state || '',
            postalCode: proposal.billingAddress?.postcode || '',
            country: 'Australia'
          }
        ]
      };
      
      // Create new contact
      const createContactResponse = await xero.accountingApi.createContacts(tenantId, { contacts: [newContact] });
      contactId = createContactResponse.body.contacts[0].contactID;
      console.log(`New Contact created: ${proposal.clientName} (${contactId})`);
    }
    
    // 2. Build Invoice Details
    const price = parseFloat(proposal.price.replace(/,/g, '')) || 0;
    const hasGST = proposal.taxLabel && proposal.taxLabel.toLowerCase().includes('gst');
    
    // Set amounts to Tax Inclusive/Exclusive
    const lineAmountType = hasGST ? 'Inclusive' : 'Exclusive';
    
    let lineDescription = `${proposal.title}\n`;
    if (proposal.inclusions && proposal.inclusions.length > 0) {
      lineDescription += `\nService Inclusions:\n` + proposal.inclusions.map(inc => `• ${inc}`).join('\n');
    }
    
    const lineItems = [
      {
        description: lineDescription,
        quantity: 1.0,
        unitAmount: price,
        accountCode: '200', // Default Sales account code in Xero demo charts
        taxType: hasGST ? 'OUTPUT' : 'NONE' // OUTPUT is standard 10% sales tax in AU Xero orgs
      }
    ];
    
    // Unique Invoice Reference Number
    const shortId = proposal.id.substring(0, 5).toUpperCase();
    const invoiceNumber = `SD-${shortId}-${Date.now().toString().slice(-6)}`;
    
    const newInvoice = {
      type: 'ACCREC', // Receivable sales invoice
      contact: { contactID: contactId },
      lineItems: lineItems,
      invoiceNumber: invoiceNumber,
      reference: `Proposal #${proposal.id}`,
      lineAmountTypes: lineAmountType,
      date: new Date().toISOString().split('T')[0], // Today's Date
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0], // 48 Hours Term
      status: 'AUTHORISED' // Pre-approve invoice to make it instantly ready for payment gateway redirects
    };
    
    // 3. Create invoice
    const createInvoiceResponse = await xero.accountingApi.createInvoices(tenantId, { invoices: [newInvoice] });
    const createdInvoice = createInvoiceResponse.body.invoices[0];
    const invoiceId = createdInvoice.invoiceID;
    
    console.log(`Xero Invoice generated successfully: ${invoiceNumber} (${invoiceId})`);
    
    // 4. Retrieve Online Payment Gateway URL from Xero
    const getOnlineUrlResponse = await xero.accountingApi.getOnlineInvoice(tenantId, invoiceId);
    const onlineInvoiceUrl = getOnlineUrlResponse.body.onlineInvoices[0].onlineInvoiceUrl;
    
    console.log(`Retrieved Xero payment URL: ${onlineInvoiceUrl}`);
    
    res.json({
      success: true,
      invoiceId: invoiceId,
      invoiceNumber: createdInvoice.invoiceNumber,
      amountDue: createdInvoice.amountDue,
      onlineInvoiceUrl: onlineInvoiceUrl
    });
    
  } catch (err) {
    console.error('Xero Invoice generation failed:', err);
    
    // Extract validation feedback from Xero payload
    const xeroErrors = err.response && err.response.body && err.response.body.Elements
      ? err.response.body.Elements.flatMap(el => el.ValidationErrors || []).map(ve => ve.Message)
      : [];
      
    res.status(500).json({
      error: 'Failed to create invoice in Xero.',
      details: err.message,
      validationErrors: xeroErrors
    });
  }
});

// API Endpoint to Send Proposal Email via SMTP
app.post('/api/email/send-proposal', async (req, res) => {
  const { proposalId, clientEmail, clientName, proposalTitle, price } = req.body;

  if (!proposalId || !clientEmail || !clientName || !proposalTitle) {
    return res.status(400).json({ error: 'Missing required email parameters.' });
  }

  // Check if SMTP credentials are set
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP Credentials are not configured in .env. Email logging to console instead.');
    const proposalUrl = `${frontendUrl}/Proposal system/proposal.html?id=${proposalId}`;
    console.log(`\n--- Simulated Email Send ---`);
    console.log(`To: ${clientEmail}`);
    console.log(`Subject: Your Custom Property Staging Proposal: ${proposalTitle}`);
    console.log(`Body:\nDear ${clientName},\n\nWe are delighted to present your tailored property styling proposal for ${proposalTitle}.\n\nWith 16 years in the market and more than 6,000 properties beautifully styled, our team knows exactly how to capture buyers' attention. In fact, our strategic styling added over $42,000,000 in market value to our clients' properties last year alone—and we look forward to helping your property stand out to potential buyers.\n\nPlease click the link below to review your interactive, digital proposal and explore your customized room-by-room design concept:\n\n[VIEW STYLING PROPOSAL]: ${proposalUrl}\n\nNext Steps to Secure Your Date:\nTo move forward and secure your spot, simply click the link above to input your details and sign the digital agreement. Due to high demand, we highly recommend completing the proposal soon to secure your preferred installation date.\n\nIf you have any questions at all, please don't hesitate to reach out. We are so excited to work together to showcase your property's full potential!\n\nWarm regards,\n\n[IMAGE SIGNATURE: signature.jpg]`);
    console.log(`-----------------------------\n`);
    return res.json({ 
      success: true, 
      simulated: true, 
      message: 'SMTP not configured in .env. Email logged to server console.' 
    });
  }

  const proposalUrl = `${frontendUrl}/Proposal system/proposal.html?id=${proposalId}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Sale by Design Homes" <proposals@salebydesignhomes.com.au>',
    to: clientEmail,
    subject: `Your Custom Property Staging Proposal: ${proposalTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @media only screen and (max-width: 520px) {
            .email-container {
              padding: 20px 10px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff;">
        <div class="email-container" style="font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 10px auto; padding: 30px 20px; background-color: #ffffff; color: #333333; box-sizing: border-box; width: 95%;">
          <!-- Header (Pure HTML/CSS Logo to avoid SVG email client issues) -->
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #e8e6e1; padding-bottom: 20px; font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif; user-select: none;">
            <div style="font-size: 12px; font-weight: 500; color: #1c1c1c; letter-spacing: 0.35em; text-transform: uppercase; margin-bottom: 3px; line-height: 1.2; padding-left: 0.35em;">SALE BY DESIGN</div>
            <div style="font-size: 44px; font-weight: 900; color: #1c1c1c; letter-spacing: -0.03em; text-transform: uppercase; line-height: 0.9;">HOMES</div>
          </div>

          <!-- Body -->
          <div style="font-size: 14px; line-height: 1.6; color: #444444;">
            <p style="margin-top: 0; margin-bottom: 16px;">Dear <strong>${clientName}</strong>,</p>
            
            <p style="margin-bottom: 16px;">We are delighted to present your tailored property styling proposal for <strong>${proposalTitle}</strong>.</p>
            
            <p style="margin-bottom: 16px;">With 16 years in the market and more than 6,000 properties beautifully styled, our team knows exactly how to capture buyers' attention. In fact, our strategic styling added over $42,000,000 in market value to our clients' properties last year alone—and we look forward to helping your property stand out to potential buyers.</p>
            
            <p style="margin-bottom: 16px;">Please click the link below to review your interactive, digital proposal and explore your customized room-by-room design concept:</p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${proposalUrl}" target="_blank" style="background-color: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-weight: 600; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 3px; display: inline-block;">View Staging Proposal</a>
            </div>

            <!-- Highlight Box for Next Steps -->
            <div style="background-color: #f6f5f1; border-left: 3px solid #ad8f65; padding: 15px 20px; margin: 25px 0; border-radius: 0 4px 4px 0;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #4a432b; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase;">Next Steps to Secure Your Date:</p>
              <p style="margin: 0; font-size: 12.5px; line-height: 1.5; color: #555555;">To move forward and secure your spot, simply click the link above to input your details and sign the digital agreement. Due to high demand, we highly recommend completing the proposal soon to secure your preferred installation date.</p>
            </div>

            <p style="margin-bottom: 20px;">If you have any questions at all, please don't hesitate to reach out. We are so excited to work together to showcase your property's full potential!</p>
            
            <p style="margin-bottom: 15px;">Warm regards,</p>
            
            <!-- Elegant Signature Block -->
            <div style="margin-top: 20px;">
              <img src="cid:email_signature" alt="Deshan Wijeratne - Operations Manager - Sale by Design Homes" style="width: 100%; max-width: 500px; height: auto; display: block; border: 0;">
            </div>
          </div>

          <!-- Muted Footer Note -->
          <div style="margin-top: 35px; padding-top: 15px; border-top: 1px solid #e8e6e1; font-size: 9px; text-align: center; color: #aaaaaa; font-style: italic;">
            This is an automated proposal notification. Please do not reply directly to this email.
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: 'signature.jpg',
        path: path.join(__dirname, 'Proposal system/images/signature.jpg'),
        cid: 'email_signature'
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Proposal email sent via SMTP successfully to ${clientEmail}: ${info.messageId}`);
    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('SMTP email sending failed:', err);
    res.status(500).json({ error: 'Failed to send email via SMTP.', details: err.message });
  }
});

// Serve frontend build static output in production
app.use(express.static(path.join(__dirname, 'dist')));

await app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Initialize database and start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Database initialization failed:", err);
  });
