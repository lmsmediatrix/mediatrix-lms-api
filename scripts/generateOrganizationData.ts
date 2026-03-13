import { faker } from "@faker-js/faker";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Organization from "../models/organizationModel";
import { ORGANIZATION_PLAN, ORGANIZATION_STATUS } from "../config/common";

// Load environment variables
dotenv.config();

// Connect to the database
const connectDB = async () => {
  try {
    const uri = process.env.DB_URI;
    if (!uri) throw new Error("DB_URI is not defined in environment variables");
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Generate a realistic color code
const generateColor = () => {
  return faker.internet.color();
};

// Generate more realistic image URLs
const generateRealisticImageUrl = (type: "logo" | "coverPhoto", category: string) => {
  // Using Unsplash for more realistic, high-quality images
  if (type === "logo") {
    // Logo images should be simpler, more icon-like
    return `https://source.unsplash.com/featured/?${encodeURIComponent(category + ",logo,icon")}&w=200&h=200`;
  } else {
    // Cover photos should be landscape oriented and contextual to the organization
    return `https://source.unsplash.com/featured/?${encodeURIComponent(category + ",business,building")}&w=1200&h=400`;
  }
};

// Generate realistic branding
const generateBranding = (orgName: string, orgType: "school" | "corporate") => {
  // Determine appropriate category based on organization type
  const logoCategory = orgType === "school" ? "education" : "business";
  const coverCategory = orgType === "school" ? "campus" : "office";

  return {
    logo: generateRealisticImageUrl("logo", logoCategory),
    coverPhoto: generateRealisticImageUrl("coverPhoto", coverCategory),
    font: faker.helpers.arrayElement([
      "Roboto",
      "Open Sans",
      "Lato",
      "Montserrat",
      "Poppins",
      "Arial",
      "Helvetica",
      "Georgia",
    ]),
    colors: {
      primary: generateColor(),
      secondary: generateColor(),
      accent: generateColor(),
      success: generateColor(),
      warning: generateColor(),
      danger: generateColor(),
      info: generateColor(),
      light: generateColor(),
      dark: generateColor(),
      neutral: generateColor(),
    },
  };
};

// Generate a school organization
const generateSchoolOrganization = (count: number) => {
  const schoolTypes = [
    "University",
    "College",
    "High School",
    "Elementary School",
    "Middle School",
    "Vocational School",
    "Technical Institute",
    "Academy",
    "Institute",
    "International School",
  ];

  const schoolKeywords = [
    "Technology",
    "Science",
    "Arts",
    "Liberal Arts",
    "Business",
    "Medicine",
    "Engineering",
    "Languages",
    "Mathematics",
    "Social Sciences",
    "Computer Science",
    "Education",
    "Leadership",
    "Innovation",
  ];

  const organizations = [];

  for (let i = 0; i < count; i++) {
    const schoolType = faker.helpers.arrayElement(schoolTypes);
    const keyword = faker.helpers.arrayElement(schoolKeywords);

    // Generate realistic school names
    let name: string;
    if (faker.number.int({ min: 0, max: 10 }) > 7) {
      // Named after a person
      name = `${faker.person.lastName()} ${schoolType} of ${keyword}`;
    } else if (faker.number.int({ min: 0, max: 10 }) > 5) {
      // Geographic name
      name = `${faker.location.city()} ${schoolType}`;
    } else {
      // Descriptive name
      name = `${faker.word.adjective({ length: { min: 4, max: 7 } })} ${keyword} ${schoolType}`;
    }

    const code = name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    organizations.push({
      name,
      description: faker.lorem.paragraph({ min: 3, max: 6 }),
      code:
        code.length >= 4
          ? code.substring(0, Math.min(code.length, 10))
          : code + faker.string.alphanumeric(4 - code.length).toUpperCase(),
      type: "school",
      admins: [],
      students: [],
      instructors: [],
      courses: [],
      plan: faker.helpers.arrayElement(ORGANIZATION_PLAN),
      status: faker.helpers.arrayElement(ORGANIZATION_STATUS),
      branding: generateBranding(name, "school"),
      transactions: [],
      isDeleted: false,
      archive: {
        status: faker.datatype.boolean({ probability: 0.05 }),
        date: faker.datatype.boolean({ probability: 0.05 }) ? faker.date.past() : null,
      },
    });
  }

  return organizations;
};

// Generate a corporate organization
const generateCorporateOrganization = (count: number) => {
  const corporateTypes = [
    "Corporation",
    "LLC",
    "Inc.",
    "Ltd",
    "Group",
    "Partners",
    "Holdings",
    "Solutions",
    "Enterprises",
    "Technologies",
    "Systems",
    "Global",
    "International",
    "Consulting",
  ];

  const corporateIndustries = [
    "Technology",
    "Healthcare",
    "Finance",
    "Manufacturing",
    "Retail",
    "Energy",
    "Telecommunications",
    "Pharmaceutical",
    "Automotive",
    "Aerospace",
    "Food & Beverage",
    "Media",
    "Entertainment",
    "Education",
  ];

  const organizations = [];

  for (let i = 0; i < count; i++) {
    const corporateType = faker.helpers.arrayElement(corporateTypes);
    const industry = faker.helpers.arrayElement(corporateIndustries);

    // Generate realistic company names
    let name: string;
    if (faker.number.int({ min: 0, max: 10 }) > 7) {
      // Named after a person
      name = `${faker.person.lastName()} ${corporateType}`;
    } else if (faker.number.int({ min: 0, max: 10 }) > 5) {
      // Industry + Type
      name = `${industry} ${corporateType}`;
    } else {
      // Descriptive name
      name = `${faker.company.name()}`;
    }

    const code = name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    organizations.push({
      name,
      description: `${name} is a leading provider of ${industry.toLowerCase()} solutions, specializing in professional development and corporate training. ${faker.lorem.paragraph(2)}`,
      code:
        code.length >= 4
          ? code.substring(0, Math.min(code.length, 10))
          : code + faker.string.alphanumeric(4 - code.length).toUpperCase(),
      type: "corporate",
      admins: [],
      students: [],
      instructors: [],
      courses: [],
      plan: faker.helpers.arrayElement(ORGANIZATION_PLAN),
      status: faker.helpers.arrayElement(ORGANIZATION_STATUS),
      branding: generateBranding(name, "corporate"),
      transactions: [],
      isDeleted: false,
      archive: {
        status: faker.datatype.boolean({ probability: 0.05 }),
        date: faker.datatype.boolean({ probability: 0.05 }) ? faker.date.past() : null,
      },
    });
  }

  return organizations;
};

// Number of organizations to generate
const NUM_SCHOOL_ORGANIZATIONS = 10;
const NUM_CORPORATE_ORGANIZATIONS = 5;

// Main function to generate and save organizations
const generateOrganizations = async () => {
  try {
    await connectDB();

    const schoolOrgs = generateSchoolOrganization(NUM_SCHOOL_ORGANIZATIONS);
    const corporateOrgs = generateCorporateOrganization(NUM_CORPORATE_ORGANIZATIONS);
    const allOrgs = [...schoolOrgs, ...corporateOrgs];

    console.log(`Generating ${allOrgs.length} organizations...`);

    // Option 1: Insert all at once
    const result = await Organization.insertMany(allOrgs);
    console.log(`✅ Successfully inserted ${result.length} organizations`);

    // Option 2: Display generated data without saving
    // console.log(JSON.stringify(allOrgs, null, 2));

    mongoose.disconnect();
    console.log("Database disconnected");
  } catch (error) {
    console.error("Error generating organizations:", error);
    mongoose.disconnect();
  }
};

// Run the generator
generateOrganizations();
