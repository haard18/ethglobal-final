import cron from 'node-cron';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Function to delete old data
async function deleteOldData() {
  const client = await pool.connect();
  try {
    console.log('Starting cleanup of old data...');
    
    // Delete market_data records older than 1 hour
    const marketDataResult = await client.query(`
      DELETE FROM market_data 
      WHERE created_at < NOW() - INTERVAL '1 hour'
    `);
    
    // Delete pumpfun_events records older than 1 hour  
    const pumpfunEventsResult = await client.query(`
      DELETE FROM pumpfun_events 
      WHERE created_at < NOW() - INTERVAL '1 hour'
    `);
    
    console.log(`Cleanup completed:
      - Deleted ${marketDataResult.rowCount} market_data records
      - Deleted ${pumpfunEventsResult.rowCount} pumpfun_events records
      - Cleanup time: ${new Date().toISOString()}`);
      
  } catch (error) {
    console.error('Error during data cleanup:', error);
  } finally {
    client.release();
  }
}

// Schedule cronjob to run every minute
const startCronJob = () => {
  console.log('Starting data cleanup cronjob - runs every minute');
  
  // Cron expression: '* * * * *' means every minute
  cron.schedule('* * * * *', async () => {
    await deleteOldData();
  }, {
    scheduled: true,
    timezone: "UTC"
  });
  
  console.log('Cronjob scheduled successfully');
};

// Function to stop the cronjob gracefully
const stopCronJob = async () => {
  console.log('Stopping cronjob and closing database connections...');
  await pool.end();
};

// Handle process termination
process.on('SIGINT', async () => {
  await stopCronJob();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopCronJob();
  process.exit(0);
});

export { startCronJob, stopCronJob, deleteOldData };
