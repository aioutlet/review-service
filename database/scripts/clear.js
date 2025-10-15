import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Review from '../../src/shared/models/review.model.js';

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://dev_user:dev_pass_123@localhost:27017/review_service_db?authSource=admin';

console.log(`🔌 Connecting to MongoDB...`);
console.log(`📍 URI: ${MONGODB_URI.replace(/:[^:@]*@/, ':***@')}`); // Hide password in logs

async function clear() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count existing reviews
    const reviewCount = await Review.countDocuments();
    console.log(`📊 Found ${reviewCount} reviews in database`);

    if (reviewCount === 0) {
      console.log('💡 Database is already empty');
      return;
    }

    // Get stats before clearing
    const stats = await Review.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    console.log('\n📈 Reviews by status before clearing:');
    stats.forEach((stat) => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });

    // Clear all reviews
    const deleteResult = await Review.deleteMany({});
    console.log(`\n✅ Successfully deleted ${deleteResult.deletedCount} reviews!`);

    // Verify deletion
    const remainingCount = await Review.countDocuments();
    if (remainingCount === 0) {
      console.log('🎉 Database cleared successfully!');
    } else {
      console.log(`⚠️  Warning: ${remainingCount} reviews still remain`);
    }
  } catch (error) {
    console.error('❌ Clear operation failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

clear();
