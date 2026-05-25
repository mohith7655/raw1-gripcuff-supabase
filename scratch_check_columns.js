const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dyjfzuzrjgwjmhojhmjj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5amZ6dXpyamd3am1ob2pobWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTQ1NDgsImV4cCI6MjA5NDc5MDU0OH0.wo5AKZy1OXJDt6xyxRf6Pw3GVfzhGPLpyBzdW9ntURQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const columnsToTest = [
  'last_workout_date',
  'current_streak',
  'best_streak',
  'weekly_activity',
  'completed_workouts',
  'watched_minutes',
  'streak',
  'completed_videos'
];

async function testColumn(col) {
  const payload = {
    id: '00000000-0000-0000-0000-000000000000',
    [col]: col === 'last_workout_date' ? '2026-05-20' : 
           col === 'weekly_activity' ? {} : 1
  };
  const { error } = await supabase.from('users').upsert(payload);
  if (error && error.message.includes('Could not find the')) {
    return false;
  }
  return true;
}

async function main() {
  console.log('Testing column existence in Supabase users table:');
  for (const col of columnsToTest) {
    const exists = await testColumn(col);
    console.log(`- ${col}: ${exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
  }
}

main();
