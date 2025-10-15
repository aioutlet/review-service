import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Review from '../../src/shared/models/review.model.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://dev_user:dev_pass_123@localhost:27017/review_service_db?authSource=admin';

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:8003';

console.log(`🔌 Connecting to MongoDB...`);
console.log(`📍 URI: ${MONGODB_URI.replace(/:[^:@]*@/, ':***@')}`); // Hide password in logs

async function getProductIds() {
  try {
    console.log(`🔍 Fetching product IDs from product service...`);
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products?limit=10`);

    if (response.data.success && response.data.data.products) {
      const productIds = response.data.data.products.map((p) => p.id);
      console.log(`✅ Found ${productIds.length} products`);
      return productIds;
    } else {
      console.warn('⚠️  Could not fetch product IDs, using sample data as-is');
      return [];
    }
  } catch (error) {
    console.warn(`⚠️  Could not fetch product IDs: ${error.message}`);
    console.warn('⚠️  Using placeholder IDs in sample data');
    return [];
  }
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data first
    const deleteResult = await Review.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing reviews`);

    // Read sample data
    const dataPath = join(__dirname, '../data/sample-reviews.json');
    let reviews = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`📖 Read ${reviews.length} reviews from sample data`);

    // Try to get real product IDs and replace placeholders
    const productIds = await getProductIds();

    if (productIds.length > 0) {
      console.log(`🔄 Replacing placeholder IDs with real product IDs...`);

      // Map placeholders to real IDs
      const placeholderMap = {
        PLACEHOLDER_1: productIds[0],
        PLACEHOLDER_2: productIds[1],
        PLACEHOLDER_3: productIds[2],
        PLACEHOLDER_4: productIds[3],
        PLACEHOLDER_5: productIds[4],
      };

      // Replace placeholders in reviews
      reviews = reviews.map((review) => ({
        ...review,
        productId: placeholderMap[review.productId] || review.productId,
      }));

      console.log(`✅ Updated reviews with real product IDs`);
    } else {
      // If no product IDs available, generate valid ObjectIds as placeholders
      console.log(`⚠️  No product IDs available, using generated ObjectIds`);
      const ObjectId = mongoose.Types.ObjectId;
      const placeholderMap = {
        PLACEHOLDER_1: new ObjectId().toString(),
        PLACEHOLDER_2: new ObjectId().toString(),
        PLACEHOLDER_3: new ObjectId().toString(),
        PLACEHOLDER_4: new ObjectId().toString(),
        PLACEHOLDER_5: new ObjectId().toString(),
      };

      reviews = reviews.map((review) => ({
        ...review,
        productId: placeholderMap[review.productId] || review.productId,
      }));
    }

    // Add timestamps to reviews
    const now = new Date();
    reviews = reviews.map((review, index) => ({
      ...review,
      metadata: {
        createdAt: new Date(now - (reviews.length - index) * 24 * 60 * 60 * 1000), // Spread over days
        updatedAt: new Date(now - (reviews.length - index) * 24 * 60 * 60 * 1000),
        source: 'web',
      },
    }));

    const insertResult = await Review.insertMany(reviews);
    console.log(`✅ Successfully seeded ${insertResult.length} reviews!`);

    // Display seeded reviews summary
    const reviewSummary = insertResult.map((review) => ({
      productId: review.productId.substring(0, 8) + '...',
      username: review.username,
      rating: review.rating,
      helpful: review.helpfulVotes.helpful,
      status: review.status,
      verified: review.isVerifiedPurchase ? '✓' : '✗',
    }));

    console.table(reviewSummary);

    // Get aggregated stats
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          verifiedCount: {
            $sum: { $cond: ['$isVerifiedPurchase', 1, 0] },
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
          },
        },
      },
    ]);

    if (stats.length > 0) {
      console.log('\n📊 Review Statistics:');
      console.log(`   Total Reviews: ${stats[0].totalReviews}`);
      console.log(`   Average Rating: ${stats[0].avgRating.toFixed(2)} ⭐`);
      console.log(`   Verified Purchases: ${stats[0].verifiedCount}`);
      console.log(`   Approved Reviews: ${stats[0].approvedCount}`);
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    if (error.code === 11000) {
      console.error('⚠️  Duplicate key error - review already exists for this user/product combination');
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

seed();
