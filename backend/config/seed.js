import Category from '../models/Category.js';
import ComplaintType from '../models/ComplaintType.js';
import Contact from '../models/Contact.js';
import AdminUser from '../models/AdminUser.js';

const defaultCategories = [
  "Hostel Issues",
  "Food Issues",
  "Campus Issues",
  "Complaint Against Student",
  "Complaint Against Faculty",
  "Bus Issues"
];

const defaultComplaintTypes = {
  "Hostel Issues": [
    "Fan Not Working", "Light Not Working", "Water Problem", "Electricity Issue",
    "WiFi Issue", "Room Cleaning", "Washroom Cleaning", "Mess Hygiene",
    "Mess Timing", "Room Allocation", "Warden Behaviour", "Warden Harassment",
    "Security Issue", "Other"
  ],
  "Food Issues": [
    "Poor Food Quality", "High Prices", "Less Quantity", "Expired Food",
    "Mess Hygiene", "Dirty Utensils", "Canteen Behaviour", "Cafeteria Behaviour",
    "Other"
  ],
  "Campus Issues": [
    "Classroom Fan Not Working", "Projector Not Working", "Electrical Issue",
    "Water Not Available", "Broken Bench", "Campus Cleaning", "Parking Issue",
    "Internet Issue", "Laboratory Equipment", "Washroom Cleaning", "Other"
  ],
  "Complaint Against Student": [
    "Ragging", "Bullying", "Teasing", "Harassment", "Threatening",
    "Demanding Money", "Verbal Abuse", "Taking Photos Without Permission",
    "Asking Personal Information", "Other"
  ],
  "Complaint Against Faculty": [
    "Misbehavior", "Partiality", "Harassment", "Attendance Issue",
    "Marks Related Concern", "Mental Pressure", "Unprofessional Conduct",
    "Inappropriate Language", "Other"
  ],
  "Bus Issues": [
    "Driver Behaviour", "Rash Driving", "Bus Timing Issue", "Bus Not Arriving",
    "Bus Breakdown", "Bus Cleanliness", "Overcrowding", "Faculty Behaviour in Bus",
    "Bus Staff Behaviour", "Route Change", "Safety Issue", "Bus Condition", "Other"
  ]
};

const defaultContacts = [
  { category: "Hostel Issues", department: "Hostel Management / Discipline Head", phone: "9959593027" },
  { category: "Food Issues", department: "Canteen / Food Management", phone: "9391781748" },
  { category: "Bus Issues", department: "Bus Management", phone: "7330820239" },
  { category: "Campus Issues", department: "Respective HOD", phone: "N/A" },
  { category: "Complaint Against Student", department: "Discipline Committee", phone: "N/A" },
  { category: "Complaint Against Faculty", department: "Discipline Committee", phone: "N/A" }
];

export const seedDatabase = async () => {
  try {
    console.log('[Seeding] Starting idempotent database seed...');

    // 1. Seed Categories (Idempotently via findOneAndUpdate with upsert)
    for (const cat of defaultCategories) {
      await Category.findOneAndUpdate(
        { name: cat },
        { $setOnInsert: { name: cat, isActive: true } },
        { upsert: true, new: true }
      );
    }
    console.log('[Seeding] Categories seed check complete.');

    // Fetch seeded categories to get ObjectIds for ComplaintType mappings
    const dbCategories = await Category.find({});
    const categoryMap = {};
    dbCategories.forEach(cat => {
      categoryMap[cat.name] = cat._id;
    });

    // 2. Seed Complaint Types (Idempotently via compound query check)
    for (const [catName, types] of Object.entries(defaultComplaintTypes)) {
      const catId = categoryMap[catName];
      if (catId) {
        for (const t of types) {
          await ComplaintType.findOneAndUpdate(
            { name: t, category: catId },
            { $setOnInsert: { name: t, category: catId, isActive: true } },
            { upsert: true }
          );
        }
      }
    }
    console.log('[Seeding] Complaint types seed check complete.');

    // 3. Seed Helpline Contacts (Idempotently)
    for (const item of defaultContacts) {
      await Contact.findOneAndUpdate(
        { category: item.category },
        { $setOnInsert: { category: item.category, department: item.department, phone: item.phone } },
        { upsert: true }
      );
    }
    console.log('[Seeding] Helpline contacts seed check complete.');

    // 4. Seed Admin Account (Check existence first to NEVER overwrite modified production passwords)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mictech.ac.in';
    const adminPassword = process.env.ADMIN_PASSWORD || 'MIC@Admin#2026';
    
    const adminExists = await AdminUser.findOne({ email: adminEmail });
    if (!adminExists) {
      // Create new admin (will trigger the pre-save hook to hash password)
      await AdminUser.create({
        email: adminEmail,
        password: adminPassword
      });
      console.log(`[Seeding] Created initial admin account: ${adminEmail}`);
    } else {
      console.log(`[Seeding] Admin account already exists (${adminEmail}). Skipping password seed...`);
    }

    console.log('[Seeding] Database seeding complete successfully.');
  } catch (error) {
    console.error(`[Seeding Error] Database seeding encountered an error: ${error.message}`);
  }
};
