const mongoose = require("mongoose");

async function run() {
  require("dotenv").config();
  await mongoose.connect(process.env.DB_URI);

  const Lesson = mongoose.connection.collection("lessons");
  const now = new Date();
  console.log("Current UTC time:", now.toISOString());

  const lessons = await Lesson.find(
    {
      "archive.status": { $ne: true },
      startDate: { $lte: now },
      endDate: { $gte: now },
    },
    { projection: { title: 1, startDate: 1, endDate: 1 } }
  ).toArray();

  console.log(`\nFound ${lessons.length} active lessons:`);
  lessons.forEach((l) => {
    console.log(`  - ${l.title} | start: ${l.startDate} | end: ${l.endDate}`);
  });

  // Also check all lessons with March 10 in range
  const mar10 = new Date("2026-03-10T00:00:00Z");
  const mar11 = new Date("2026-03-11T00:00:00Z");
  const mar10Lessons = await Lesson.find(
    {
      "archive.status": { $ne: true },
      startDate: { $lte: mar11 },
      endDate: { $gte: mar10 },
    },
    { projection: { title: 1, startDate: 1, endDate: 1 } }
  ).toArray();

  console.log(`\nAll lessons covering March 10:`);
  mar10Lessons.forEach((l) => {
    console.log(`  - ${l.title} | start: ${l.startDate} | end: ${l.endDate}`);
  });

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
