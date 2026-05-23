import cron from 'node-cron';
import { run } from '../db/database.js';

export function startScheduler() {
 
  cron.schedule('* * * * *', async () => {
    try {
      const result = await run(`
        UPDATE programs
        SET status = 'closed'
        WHERE status = 'open'
          AND (
            (end_date IS NOT NULL AND DATE(end_date) < CURDATE())
            OR
            (slots > 0 AND slots_used >= slots)
          )
      `);
      if (result.affectedRows > 0) {
        console.log(`[Scheduler] Auto-closed ${result.affectedRows} program(s).`);
      }
    } catch (e) {
      console.error('[Scheduler] Error:', e.message);
    }
  });

  console.log(' Scheduler started — checking programs every minute.');
}