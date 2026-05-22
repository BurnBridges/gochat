const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URL;

  if (!uri) {
    console.error("❌ MONGO_URL is missing");
    process.exit(1);
  }

  try {
    console.log("TRY CONNECT MONGO...");

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("MongoDB connected");
  } catch (err) {
    console.error("❌ Mongo connection error:");
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;